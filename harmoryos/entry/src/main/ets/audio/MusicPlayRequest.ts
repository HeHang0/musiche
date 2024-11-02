import { MusicItem } from "./MusicItem";

export class MusicPlayRequest {
  public music?: MusicItem;
  public index = 0;
  public playlist:MusicItem[] = [];
  constructor(data?: Record<string, any>) {
    data && this.setData(data)
  }

  public setData(data: Record<string, any>){
    this.playlist.splice(0, Infinity)
    if(Array.isArray(data.playlist)) {
      data.playlist.forEach(m => {
        const music = new MusicItem(m)
        if(music.id) {
          this.playlist.push(music)
        }
      })
    }
    if(data.music) {
      const music = this.playlist.find(m => m.id === data.music.id && m.type === data.music.type)
      if(music.id) {
        this.music = music
      }
    }
  }
}