import { TFile, Vault } from 'obsidian';
import { RAGFlowSyncSettings } from './settings';
import { RAGFlowAPI, Dataset, Document } from './ragflow-api';
import * as CryptoJS from 'crypto-js';

interface SyncedNote {
    path: string;
    md5: string;
    documentId: string;
    lastSynced: number;
    status: 'success' | 'failed';
    error?: string;
}

export interface SyncProgress {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    status: 'idle' | 'running' | 'completed' | 'error';
    message?: string;
}

export class SyncManager {
    private vault: Vault;
    private settings: RAGFlowSyncSettings;
    private api: RAGFlowAPI;
    private syncedNotes: Record<string, SyncedNote> = {};
    private progress: SyncProgress = {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        status: 'idle'
    };
    private dataset: Dataset | null = null;
    private isStopping: boolean = false;

    constructor(vault: Vault, settings: RAGFlowSyncSettings) {
        this.vault = vault;
        this.settings = settings;
        this.api = new RAGFlowAPI(settings);
    }

    getProgress(): SyncProgress {
        return { ...this.progress };
    }

    stopSync(): void {
        if (this.progress.status === 'running') {
            this.isStopping = true;
            this.progress.message = 'Stopping sync...';
        }
    }

    isSyncRunning(): boolean {
        return this.progress.status === 'running';
    }

    // 索引文件的路径
    private readonly INDEX_FILE_PATH = '.obsidian/plugins/obsidian-ragflow-sync/synced-notes.json';

    async loadSyncedNotes(): Promise<void> {
        try {
            // 检查索引文件是否存在
            const adapter = this.vault.adapter;
            const exists = await adapter.exists(this.INDEX_FILE_PATH);

            if (exists) {
                // 读取索引文件
                const data = await adapter.read(this.INDEX_FILE_PATH);
                if (data) {
                    this.syncedNotes = JSON.parse(data);
                    console.log(`Loaded ${Object.keys(this.syncedNotes).length} synced notes from index file`);
                }
            } else {
                // 如果索引文件不存在，初始化为空对象
                this.syncedNotes = {};
                console.log('No existing index file found. Starting with empty index.');
            }
        } catch (error) {
            console.error('Failed to load synced notes:', error);
            this.syncedNotes = {};
        }
    }

    private async saveSyncedNotes(): Promise<void> {
        try {
            // 确保目录存在
            const adapter = this.vault.adapter;
            const dirPath = this.INDEX_FILE_PATH.substring(0, this.INDEX_FILE_PATH.lastIndexOf('/'));

            // 创建目录（如果不存在）
            if (!(await adapter.exists(dirPath))) {
                await adapter.mkdir(dirPath);
            }

            // 将索引数据写入文件
            await adapter.write(
                this.INDEX_FILE_PATH,
                JSON.stringify(this.syncedNotes, null, 2)
            );

            console.log(`Saved ${Object.keys(this.syncedNotes).length} synced notes to index file`);
        } catch (error) {
            console.error('Failed to save synced notes:', error);
        }
    }

    private async calculateMD5(content: string): Promise<string> {
        return CryptoJS.MD5(content).toString();
    }

    private shouldExcludeFile(file: TFile): boolean {
        // Exclude non-markdown files
        if (file.extension !== 'md') {
            return true;
        }

        // Check if file is in excluded folder
        for (const folder of this.settings.excludeFolders) {
            if (file.path.startsWith(folder + '/')) {
                return true;
            }
        }

        return false;
    }

    private async chunkContent(content: string): Promise<string[]> {
        // Simple chunking by paragraphs
        const paragraphs = content.split('\n\n');
        const chunks: string[] = [];
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length > this.settings.chunkSize) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }

                // If a single paragraph is larger than chunk size, split it further
                if (paragraph.length > this.settings.chunkSize) {
                    const words = paragraph.split(' ');
                    for (const word of words) {
                        if (currentChunk.length + word.length + 1 > this.settings.chunkSize) {
                            chunks.push(currentChunk);
                            currentChunk = word;
                        } else {
                            currentChunk += (currentChunk.length > 0 ? ' ' : '') + word;
                        }
                    }
                } else {
                    currentChunk = paragraph;
                }
            } else {
                currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
            }
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    async startSync(): Promise<void> {
        // Reset stopping flag
        this.isStopping = false;

        this.progress = {
            total: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
            status: 'running'
        };

        try {
            // Load previously synced notes
            await this.loadSyncedNotes();

            // Get or create the dataset
            this.dataset = await this.api.getOrCreateDataset(this.settings.knowledgeBaseName);
            if (!this.dataset) {
                throw new Error('Failed to get or create dataset');
            }

            // Get all markdown files
            const files = this.vault.getMarkdownFiles();
            const filesToSync = files.filter(file => !this.shouldExcludeFile(file));

            this.progress.total = filesToSync.length;

            // Process each file
            for (const file of filesToSync) {
                // Check if sync was stopped
                if (this.isStopping) {
                    this.progress.status = 'completed';
                    this.progress.message = 'Sync stopped by user';
                    break;
                }

                try {
                    await this.syncFile(file);
                    this.progress.succeeded++;
                } catch (error) {
                    console.error(`Failed to sync file ${file.path}:`, error);
                    this.progress.failed++;

                    // Update synced notes with error
                    this.syncedNotes[file.path] = {
                        path: file.path,
                        md5: '',
                        documentId: '',
                        lastSynced: Date.now(),
                        status: 'failed',
                        error: error.message
                    };
                }

                this.progress.processed++;
                await this.saveSyncedNotes();
            }

            // Only set to completed if not already set (e.g., by stopping)
            if (this.progress.status === 'running') {
                this.progress.status = 'completed';
            }
        } catch (error) {
            console.error('Sync failed:', error);
            this.progress.status = 'error';
            this.progress.message = error.message;
        }

        // Reset stopping flag
        this.isStopping = false;
    }

    private async syncFile(file: TFile): Promise<void> {
        if (!this.dataset) {
            throw new Error('Dataset not initialized');
        }

        // Read file content
        const content = await this.vault.cachedRead(file);

        // Calculate MD5
        const md5 = await this.calculateMD5(content);

        // Check if file has changed since last sync
        const syncedNote = this.syncedNotes[file.path];
        if (syncedNote && syncedNote.md5 === md5 && syncedNote.status === 'success') {
            // File hasn't changed, skip
            return;
        }

        // Chunk the content
        const chunks = await this.chunkContent(content);

        // Create or update document
        let document: Document | null;
        if (syncedNote && syncedNote.documentId) {
            // TODO: Implement document update if needed
            // For now, we'll just use the existing document ID
            document = { id: syncedNote.documentId, name: file.name, dataset_id: this.dataset.id };
        } else {
            // Create new document
            document = await this.api.createDocument(this.dataset.id, file.name, content);
            if (!document) {
                throw new Error('Failed to create document');
            }
        }

        // Add chunks
        for (const chunk of chunks) {
            const result = await this.api.addChunk(this.dataset.id, document.id, chunk);
            if (!result) {
                throw new Error('Failed to add chunk');
            }
        }

        // Update synced notes
        this.syncedNotes[file.path] = {
            path: file.path,
            md5: md5,
            documentId: document.id,
            lastSynced: Date.now(),
            status: 'success'
        };
    }
}
