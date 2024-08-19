import { StoreType } from './type';

export class IndexDB {
  private db?: IDBDatabase;
  private storeName: string;
  public handleCache: {
    [key: string]: { key: string; handler: FileSystemDirectoryHandle };
  } = {};
  constructor(storeName: StoreType) {
    this.storeName = storeName;
    this.openDatabase();
  }

  openDatabase() {
    let request = indexedDB.open('musiche-web-db', 1);
    request.onupgradeneeded = this.onDatabaseUpgrade.bind(this);
    request.onsuccess = this.onDatabaseSuccess.bind(this);
  }

  onDatabaseUpgrade(event: Event) {
    this.db = (event.target as IDBOpenDBRequest).result;
    if (!this.db.objectStoreNames.contains(this.storeName)) {
      this.db.createObjectStore(this.storeName, {
        keyPath: 'key'
      });
    }
  }

  onDatabaseSuccess(event: Event) {
    this.db = (event.target as IDBOpenDBRequest).result;
  }

  saveFileHandler(key: string, handler: FileSystemDirectoryHandle) {
    if (!this.handleCache[key]) this.handleCache[key] = { key, handler };
    let request = this.db
      ?.transaction(this.storeName, 'readwrite')
      .objectStore(this.storeName)
      .add({
        key,
        handler
      });
    if (!request) return;
    request.onerror = function (event) {
      console.error('db store add error', event);
    };
    request.onsuccess = function (_event) {
      // console.log('db store add success');
    };
  }

  hasFileHandler(key: string): Promise<boolean> {
    if (!this.db) return Promise.resolve(false);
    return new Promise(resolve => {
      const request = this.db!.transaction(this.storeName, 'readonly')
        .objectStore(this.storeName)
        .getKey(key);
      request.onerror = function () {
        resolve(false);
      };
      request.onsuccess = function () {
        resolve(request.result !== undefined);
      };
    });
  }

  updateHandler(item: { key: string; handler: FileSystemDirectoryHandle }) {
    this.handleCache[item.key] = item;
  }

  async getFileHandler(
    key: string
  ): Promise<{ key: string; handler: FileSystemDirectoryHandle } | null> {
    if (!this.db) return null;
    const fileHandler: {
      key: string;
      handler: FileSystemDirectoryHandle;
    } | null = await new Promise(resolve => {
      const request = this.db!.transaction(this.storeName, 'readonly')
        .objectStore(this.storeName)
        .get(key);
      request.onerror = function () {
        resolve(null);
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
    });
    if (fileHandler) {
      return this.handleCache[fileHandler['key']] || fileHandler;
    }
    return null;
  }

  async getAllFileHandler(): Promise<
    { key: string; handler: FileSystemDirectoryHandle }[] | null
  > {
    if (!this.db) return null;
    const allHandler:
      | { key: string; handler: FileSystemDirectoryHandle }[]
      | null = await new Promise(resolve => {
      const request = this.db!.transaction(this.storeName, 'readonly')
        .objectStore(this.storeName)
        .getAll();
      request.onerror = function () {
        resolve(null);
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
    });
    if (allHandler) {
      allHandler.forEach(m => {
        if (!this.handleCache[m.key]) this.handleCache[m.key] = m;
      });
    }
    return allHandler;
  }
}
