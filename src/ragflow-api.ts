import { RAGFlowSyncSettings } from './settings';

export interface Dataset {
    id: string;
    name: string;
    chunk_count: number;
    document_count: number;
}

export interface Document {
    id: string;
    name: string;
    dataset_id: string;
}

export interface Chunk {
    id: string;
    content: string;
    document_id: string;
}

export class RAGFlowAPI {
    private settings: RAGFlowSyncSettings;

    constructor(settings: RAGFlowSyncSettings) {
        this.settings = settings;
    }

    // 移除未使用的 request 方法，直接使用 fetch API

    async listDatasets(): Promise<Dataset[]> {
        try {
            const url = `${this.settings.baseUrl}/api/v1/datasets`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.code === 0 && data.data) {
                return data.data;
            } else {
                console.error('Failed to list datasets: Unexpected response format', data);
                return [];
            }
        } catch (error) {
            console.error(`Failed to list datasets: ${error}`);
            return [];
        }
    }

    async getOrCreateDataset(name: string): Promise<Dataset | null> {
        // First try to find the dataset by name
        const datasets = await this.listDatasets();
        const existingDataset = datasets.find(d => d.name === name);

        if (existingDataset) {
            return existingDataset;
        }

        // If not found, create a new dataset
        try {
            const url = `${this.settings.baseUrl}/api/v1/datasets`;
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    name: name,
                    chunk_method: 'naive',
                    parser_config: {
                        chunk_token_num: this.settings.chunkSize,
                        delimiter: '\\n',
                        layout_recognize: true
                    }
                }),
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.code === 0 && data.data) {
                return data.data;
            } else {
                console.error('Failed to create dataset: Unexpected response format', data);
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            console.error(`Failed to create dataset: ${error}`);
            throw error; // 重新抛出错误，以便上层处理
        }
    }

    async addChunk(datasetId: string, documentId: string, content: string): Promise<Chunk | null> {
        try {
            // 使用正确的 API 格式添加 chunk
            const url = `${this.settings.baseUrl}/api/v1/datasets/${datasetId}/documents/${documentId}/chunks`;
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    content: content
                }),
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.code === 0 && data.data) {
                return data.data;
            } else {
                console.error('Failed to add chunk: Unexpected response format', data);
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            console.error(`Failed to add chunk: ${error}`);
            throw error; // 重新抛出错误，以便上层处理
        }
    }

    async createDocument(datasetId: string, name: string, content: string): Promise<Document | null> {
        try {
            // 根据 RAGFlow API 文档，文档上传应该使用 multipart/form-data
            // 创建一个 FormData 对象
            const formData = new FormData();

            // 创建一个 Blob 对象，表示文件内容
            const blob = new Blob([content], { type: 'text/markdown' });

            // 将文件添加到 FormData 中
            formData.append('file', blob, name);

            // 使用 fetch API 直接发送请求，因为 Obsidian 的 requestUrl 可能不支持 FormData
            const url = `${this.settings.baseUrl}/api/v1/datasets/${datasetId}/documents`;
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.code === 0 && data.data && data.data.length > 0) {
                return data.data[0];
            } else {
                console.error('Failed to create document: Unexpected response format', data);
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            console.error(`Failed to create document: ${error}`);
            throw error; // 重新抛出错误，以便上层处理
        }
    }
}
