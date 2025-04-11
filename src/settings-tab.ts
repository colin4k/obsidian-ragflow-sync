import { App, PluginSettingTab, Setting } from 'obsidian';
import RAGFlowSyncPlugin from '../main';
import { RAGFlowSyncSettings } from './settings';

export class RAGFlowSyncSettingTab extends PluginSettingTab {
    plugin: RAGFlowSyncPlugin;

    constructor(app: App, plugin: RAGFlowSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'RAGFlow Sync Settings' });

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your RAGFlow API key')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Base URL')
            .setDesc('The base URL of your RAGFlow instance')
            .addText(text => text
                .setPlaceholder('http://localhost:2081')
                .setValue(this.plugin.settings.baseUrl)
                .onChange(async (value) => {
                    this.plugin.settings.baseUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Knowledge Base Name')
            .setDesc('The name of the knowledge base to sync to')
            .addText(text => text
                .setPlaceholder('obsidian')
                .setValue(this.plugin.settings.knowledgeBaseName)
                .onChange(async (value) => {
                    this.plugin.settings.knowledgeBaseName = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sync on Startup')
            .setDesc('Automatically sync notes when Obsidian starts')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.syncOnStartup = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Exclude Folders')
            .setDesc('Comma-separated list of folders to exclude from sync')
            .addText(text => text
                .setPlaceholder('_templates,.obsidian')
                .setValue(this.plugin.settings.excludeFolders.join(','))
                .onChange(async (value) => {
                    this.plugin.settings.excludeFolders = value.split(',').map(folder => folder.trim());
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Chunk Size')
            .setDesc('Maximum size of each chunk in tokens')
            .addText(text => text
                .setPlaceholder('128')
                .setValue(String(this.plugin.settings.chunkSize))
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        this.plugin.settings.chunkSize = numValue;
                        await this.plugin.saveSettings();
                    }
                }));
    }
}
