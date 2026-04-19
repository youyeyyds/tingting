// playlist-panel/index.js
const app = getApp();

Component({
  properties: {
    chapters: {
      type: Array,
      value: [],
      observer: function(newVal) {
        // chapters 变化时，更新 sortedChapters 的进度数据
        if (this.data.visible && newVal && this.data.sortedChapters.length > 0) {
          const sortedChapters = this.data.sortedChapters.map(ch => {
            const updated = newVal.find(c => c._id === ch._id);
            if (updated) {
              return { ...ch, ...updated, isPlaying: ch.isPlaying };
            }
            return ch;
          });
          this.setData({ sortedChapters });
        }
      }
    },
    course: { type: Object, value: {} },
    currentIndex: { type: Number, value: 0 },
    currentChapterId: {
      type: String,
      value: '',
      observer: function(newVal, oldVal) {
        // 当 currentChapterId 变化时，更新 sortedChapters 的 isPlaying 状态
        if (this.data.sortedChapters.length > 0) {
          const chapters = this.data.sortedChapters.map(ch => ({
            ...ch,
            isPlaying: ch._id === newVal
          }));
          this.setData({ sortedChapters: chapters });
        }
      }
    },
    initialSortOrder: { type: String, value: 'asc' },
    isFavoriteList: { type: Boolean, value: false } // 是否是收藏列表
  },

  data: {
    visible: false,
    slideClass: '',
    playMode: 'sequence', // 'sequence' | 'loop' | 'single'
    sortOrder: 'asc',
    sortedChapters: [],
    scrollIntoView: '',
    dragIndex: -1,
    startY: 0,
    cardHeight: 60,
    confirmVisible: false
  },

  lifetimes: {
    attached() {
      const playMode = app.globalData.playMode || 'sequence';
      this.setData({ playMode });
    }
  },

  methods: {
    show() {
      // 从全局数据同步播放模式和排序状态
      const playMode = app.globalData.playMode || 'sequence';
      const sortOrder = app.globalData.playlistSortOrder || this.properties.initialSortOrder || 'asc';
      this.setData({ playMode, sortOrder });
      this.applySort();
      this.setData({ visible: true, slideClass: 'slide-up' });
      setTimeout(() => this.scrollToCurrent(), 350);
    },

    hide() {
      this.setData({ slideClass: 'slide-down' });
      setTimeout(() => {
        this.setData({ visible: false, slideClass: '' });
      }, 300);
    },

    scrollToCurrent() {
      const len = this.data.sortedChapters.length;
      if (len === 0) return;
      const currentId = this.properties.currentChapterId;
      let targetIndex = this.data.sortedChapters.findIndex(ch => ch._id === currentId);
      if (targetIndex === -1) targetIndex = 0;
      if (targetIndex > 0) targetIndex--;
      this.setData({ scrollIntoView: '' });
      setTimeout(() => this.setData({ scrollIntoView: 'card-' + targetIndex }), 50);
    },

    applySort() {
      let chapters = [...this.properties.chapters];
      const currentId = this.properties.currentChapterId;

      // 如果是收藏列表，保持原始顺序，不按 seq 排序
      if (!this.properties.isFavoriteList) {
        chapters.sort((a, b) => {
          const diff = (a.seq || 0) - (b.seq || 0);
          return this.data.sortOrder === 'asc' ? diff : -diff;
        });
      }

      chapters = chapters.map(ch => ({
        ...ch,
        isPlaying: ch._id === currentId
      }));
      this.setData({ sortedChapters: chapters });
    },

    onTogglePlayMode() {
      const modes = ['sequence', 'loop', 'single'];
      const currentIdx = modes.indexOf(this.data.playMode);
      const nextMode = modes[(currentIdx + 1) % modes.length];
      this.setData({ playMode: nextMode });
      app.globalData.playMode = nextMode;
      console.log('切换播放模式:', nextMode, 'app.globalData.playMode:', app.globalData.playMode);
    },

    onToggleSort() {
      const newOrder = this.data.sortOrder === 'asc' ? 'desc' : 'asc';
      this.setData({ sortOrder: newOrder });
      app.globalData.playlistSortOrder = newOrder;
      this.applySort();
      this.triggerEvent('syncSort', { chapters: this.data.sortedChapters });
      setTimeout(() => this.scrollToCurrent(), 100);
    },

    onClear() {
      this.setData({ confirmVisible: true });
    },

    onConfirmCancel() {
      this.setData({ confirmVisible: false });
    },

    onConfirmOk() {
      this.setData({ confirmVisible: false, visible: false, sortedChapters: [] });
      this.triggerEvent('clear');
    },

    onCardTap(e) {
      const id = e.currentTarget.dataset.id;
      const index = e.currentTarget.dataset.index;

      // 如果点击的是当前正在播放的章节，切换播放/暂停
      if (id === this.properties.currentChapterId) {
        this.triggerEvent('togglePlayPause');
        return;
      }

      // 否则播放新章节
      this.triggerEvent('play', { chapterId: id, index });
    },

    onDeleteTap(e) {
      const id = e.currentTarget.dataset.id;
      const chapters = this.data.sortedChapters.filter(ch => ch._id !== id);
      this.setData({ sortedChapters: chapters });
      this.triggerEvent('delete', { chapterId: id });
    },

    onDragStart(e) {
      const index = e.currentTarget.dataset.index;
      const touch = e.touches[0];
      this.setData({ dragIndex: index, startY: touch.clientY });
    },

    onDragMove(e) {
      if (this.data.dragIndex === -1) return;
      const touch = e.touches[0];
      const deltaY = touch.clientY - this.data.startY;
      const newIndex = Math.round(this.data.dragIndex + deltaY / this.data.cardHeight);
      if (newIndex !== this.data.dragIndex && newIndex >= 0 && newIndex < this.data.sortedChapters.length) {
        const chapters = [...this.data.sortedChapters];
        const [removed] = chapters.splice(this.data.dragIndex, 1);
        chapters.splice(newIndex, 0, removed);
        this.setData({ sortedChapters: chapters, dragIndex: newIndex, startY: touch.clientY });
      }
    },

    onDragEnd() {
      this.setData({ dragIndex: -1 });
      app.globalData.playlistChapters = this.data.sortedChapters.map(ch => ch._id);
      this.triggerEvent('syncSort', { chapters: this.data.sortedChapters });
    },

    preventMove() {}
  }
});