export interface RAGFlowSyncSettings {
    apiKey: string;
    baseUrl: string;
    knowledgeBaseName: string;
    syncOnStartup: boolean;
    excludeFolders: string[];
    chunkSize: number;
}

export const DEFAULT_SETTINGS: RAGFlowSyncSettings = {
    apiKey: '',
    baseUrl: 'http://localhost:2081',
    knowledgeBaseName: 'obsidian',
    syncOnStartup: false,
    excludeFolders: ['_templates', '.obsidian', '.git', '.github'],
    chunkSize: 128
};
