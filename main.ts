import { App, Plugin, PluginSettingTab, Setting, Notice, Modal, TFile } from 'obsidian';
import { RAGFlowSyncSettings, DEFAULT_SETTINGS } from './src/settings';
import { RAGFlowSyncSettingTab } from './src/settings-tab';
import { SyncManager, SyncProgress } from './src/sync-manager';

export default class RAGFlowSyncPlugin extends Plugin {
    settings: RAGFlowSyncSettings;
    syncManager: SyncManager;
    statusBarItem: HTMLElement;

    async onload() {
        await this.loadSettings();

        // Initialize sync manager
        this.syncManager = new SyncManager(this.app.vault, this.settings);

        // Add status bar item
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText('RAGFlow: Ready');

        // Add ribbon icon
        const ribbonIconEl = this.addRibbonIcon('upload-cloud', 'Sync to RAGFlow', async (evt: MouseEvent) => {
            new SyncModal(this.app, this).open();
        });

        // Add settings tab
        this.addSettingTab(new RAGFlowSyncSettingTab(this.app, this));

        // Add command to start sync
        this.addCommand({
            id: 'start-ragflow-sync',
            name: 'Sync notes to RAGFlow',
            callback: () => {
                new SyncModal(this.app, this).open();
            }
        });

        // Add command to stop sync
        this.addCommand({
            id: 'stop-ragflow-sync',
            name: 'Stop RAGFlow sync',
            checkCallback: (checking) => {
                const isSyncing = this.syncManager.isSyncRunning();
                if (checking) {
                    return isSyncing;
                }

                if (isSyncing) {
                    this.stopSync();
                    return true;
                }
                return false;
            }
        });

        // Sync on startup if enabled
        if (this.settings.syncOnStartup) {
            // Wait a bit for Obsidian to fully load
            setTimeout(() => {
                this.startSync();
            }, 5000);
        }
    }

    onunload() {
        // Nothing to clean up
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async startSync() {
        if (!this.settings.apiKey) {
            new Notice('RAGFlow API key is not set. Please configure it in the settings.');
            return;
        }

        if (!this.settings.knowledgeBaseName) {
            new Notice('RAGFlow knowledge base name is not set. Please configure it in the settings.');
            return;
        }

        this.statusBarItem.setText('RAGFlow: Syncing...');

        // Start the sync process
        this.syncManager.startSync();

        // Update progress periodically
        const updateInterval = setInterval(() => {
            const progress = this.syncManager.getProgress();

            this.statusBarItem.setText(`RAGFlow: ${progress.processed}/${progress.total} (${progress.succeeded} succeeded, ${progress.failed} failed)`);

            if (progress.status === 'completed' || progress.status === 'error') {
                clearInterval(updateInterval);

                if (progress.status === 'completed') {
                    this.statusBarItem.setText(`RAGFlow: Synced ${progress.succeeded}/${progress.total}`);
                    new Notice(`Successfully synced ${progress.succeeded} notes to RAGFlow. ${progress.failed} notes failed.`);
                } else {
                    this.statusBarItem.setText('RAGFlow: Sync failed');
                    new Notice(`Sync failed: ${progress.message}`);
                }
            }
        }, 1000);
    }

    stopSync() {
        if (this.syncManager.isSyncRunning()) {
            this.syncManager.stopSync();
            new Notice('Stopping sync process. Please wait for current operations to complete...');
            this.statusBarItem.setText('RAGFlow: Stopping sync...');
        }
    }
}

class SyncModal extends Modal {
    plugin: RAGFlowSyncPlugin;
    progressEl: HTMLElement;
    progressBarEl: HTMLElement;
    statusEl: HTMLElement;

    constructor(app: App, plugin: RAGFlowSyncPlugin) {
        super(app);
        this.plugin = plugin;
    }

    private startButton: HTMLButtonElement;
    private stopButton: HTMLButtonElement;
    private updateInterval: number;

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Sync to RAGFlow' });

        contentEl.createEl('p', { text: `This will sync your notes to the RAGFlow knowledge base "${this.plugin.settings.knowledgeBaseName}".` });

        // Create progress elements
        this.progressEl = contentEl.createEl('div', { cls: 'ragflow-sync-progress' });
        this.progressBarEl = this.progressEl.createEl('div', { cls: 'ragflow-sync-progress-bar' });

        this.statusEl = contentEl.createEl('div', { cls: 'ragflow-sync-status info' });
        this.statusEl.setText('Ready to sync');

        // Create buttons
        const buttonContainer = contentEl.createEl('div', { cls: 'ragflow-button-container' });

        this.startButton = buttonContainer.createEl('button', { text: 'Start Sync' });
        this.startButton.addEventListener('click', () => {
            this.startSync();
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
        });

        this.stopButton = buttonContainer.createEl('button', { text: 'Stop Sync' });
        this.stopButton.disabled = true;
        this.stopButton.addEventListener('click', () => {
            this.stopSync();
            this.stopButton.disabled = true;
        });

        const closeButton = buttonContainer.createEl('button', { text: 'Close' });
        closeButton.addEventListener('click', () => {
            this.close();
        });
    }

    async startSync() {
        this.statusEl.setText('Syncing...');
        this.statusEl.className = 'ragflow-sync-status info';

        // Start the sync process
        this.plugin.startSync();

        // Update progress periodically
        this.updateInterval = window.setInterval(() => {
            const progress = this.plugin.syncManager.getProgress();

            // Update progress bar
            const percent = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
            this.progressBarEl.style.width = `${percent}%`;

            // Update status text
            this.statusEl.setText(`Processed ${progress.processed}/${progress.total} notes (${progress.succeeded} succeeded, ${progress.failed} failed)`);

            if (progress.status === 'completed' || progress.status === 'error') {
                window.clearInterval(this.updateInterval);
                this.startButton.disabled = false;
                this.stopButton.disabled = true;

                if (progress.status === 'completed') {
                    this.statusEl.setText(`Sync completed. Successfully synced ${progress.succeeded} notes to RAGFlow. ${progress.failed} notes failed.`);
                    this.statusEl.className = 'ragflow-sync-status success';
                } else {
                    this.statusEl.setText(`Sync failed: ${progress.message}`);
                    this.statusEl.className = 'ragflow-sync-status error';
                }
            }
        }, 1000);
    }

    stopSync() {
        this.plugin.stopSync();
        this.statusEl.setText('Stopping sync...');
    }

    onClose() {
        // Clear the update interval if it exists
        if (this.updateInterval) {
            window.clearInterval(this.updateInterval);
        }

        const { contentEl } = this;
        contentEl.empty();
    }
}
