// playlist-panel/index.js
const app = getApp();

Component({
  properties: {
    chapters: {
      type: Array,
      value: [],
      observer: function(newVal) {
        if (newVal && newVal.length > 0) {
          if (this.data.isDragging || newVal[0].index !== undefined) {
            const currentId = this.properties.currentChapterId;
            const updated = newVal.map((ch, idx) => ({ ...ch, index: idx, isPlaying: ch._id === currentId }));
            this.setData({ sortedChapters: updated, hasInitialized: true });
          } else {
            this.applySort();
            this.setData({ hasInitialized: true });
          }
        }
      }
    },
    course: { type: Object, value: {} },
    currentIndex: { type: Number, value: 0 },
    currentChapterId: {
      type: String, value: '',
      observer: function(newVal) {
        if (this.data.sortedChapters.length > 0) {
          const chapters = this.data.sortedChapters.map(ch => ({ ...ch, isPlaying: ch._id === newVal }));
          this.setData({ sortedChapters: chapters });
        }
      }
    },
    initialSortOrder: { type: String, value: 'asc', observer: function(newVal) {
      if (newVal && newVal !== this.data.sortOrder) {
        this.setData({ sortOrder: newVal }, () => this.applySort());
      }
    }},
    isFavoriteList: { type: Boolean, value: false }
  },

  data: {
    visible: false, slideClass: '', playMode: 'sequence', sortOrder: 'asc',
    sortedChapters: [], scrollIntoView: '', dragIndex: -1, startY: 0, cardHeight: 60,
    confirmVisible: false, justDragEnded: false, isDragging: false, hasInitialized: false
  },

  lifetimes: {
    attached() {
      this.setData({ playMode: app.globalData.playMode || 'sequence' });
    }
  },

  methods: {
    show() {
      const playMode = app.globalData.playMode || 'sequence';
      const sortOrder = app.globalData.playlistSortOrder || this.properties.initialSortOrder || 'asc';
      this.setData({ playMode, sortOrder });
      if (this.data.sortedChapters.length > 0) {
        this.setData({ visible: true, slideClass: 'slide-up' });
        setTimeout(() => this.scrollToCurrent(), 350);
        return;
      }
      this.setData({ visible: true, slideClass: 'slide-up' });
      setTimeout(() => this.scrollToCurrent(), 350);
    },

    hide() {
      this.setData({ slideClass: 'slide-down' });
      setTimeout(() => this.setData({ visible: false, slideClass: '' }), 300);
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
      if (this.properties.chapters?.length > 0 && this.properties.chapters[0].index !== undefined) return;
      let chapters = [...this.properties.chapters];
      const currentId = this.properties.currentChapterId;
      const sortOrder = this.data.sortOrder || 'asc';

      if (this.properties.isFavoriteList) {
        if (sortOrder === 'desc') chapters.reverse();
      } else {
        chapters.sort((a, b) => {
          const diff = (a.seq || 0) - (b.seq || 0);
          return sortOrder === 'asc' ? diff : -diff;
        });
      }
      chapters = chapters.map(ch => ({ ...ch, isPlaying: ch._id === currentId }));
      this.setData({ sortedChapters: chapters });
    },

    onTogglePlayMode() {
      const nextMode = app.togglePlayMode();
      this.setData({ playMode: nextMode });
      this.triggerEvent('modeChange', { playMode: nextMode });
    },

    onToggleSort() {
      const newOrder = this.data.sortOrder === 'asc' ? 'desc' : 'asc';
      const currentId = this.properties.currentChapterId;
      const reversed = [...this.data.sortedChapters].reverse().map((ch, idx) => ({ ...ch, index: idx, isPlaying: ch._id === currentId }));
      this.setData({ sortOrder: newOrder, sortedChapters: reversed });
      app.globalData.playlistSortOrder = newOrder;
      if (!this.properties.isFavoriteList) {
        this.triggerEvent('syncSort', { chapters: reversed, sortOrder: newOrder });
      }
      setTimeout(() => this.scrollToCurrent(), 100);
    },

    onClear() { this.setData({ confirmVisible: true }); },
    onConfirmCancel() { this.setData({ confirmVisible: false }); },
    onConfirmOk() {
      this.setData({ confirmVisible: false, visible: false, sortedChapters: [] });
      this.triggerEvent('clear');
    },

    onCardTap(e) {
      if (this.data.justDragEnded) return;
      const id = e.currentTarget.dataset.id;
      if (id === this.properties.currentChapterId) {
        this.triggerEvent('togglePlayPause');
        return;
      }
      this.triggerEvent('play', { chapterId: id, index: e.currentTarget.dataset.index });
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
      this.setData({ dragIndex: index, startY: touch.clientY, isDragging: true });
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
      const sortedChapters = this.data.sortedChapters;
      const withIndex = sortedChapters.map((ch, idx) => ({ ...ch, index: idx }));
      app.globalData.playlistChapters = withIndex.map(ch => ch._id);
      app.globalData.playlistChaptersData = withIndex;
      this.triggerEvent('syncSort', { chapters: withIndex, sortOrder: this.data.sortOrder });
      this.setData({ dragIndex: -1, justDragEnded: true }, () => {
        this.setData({ isDragging: false, justDragEnded: false });
      });
    },

    preventMove() { return true; }
  }
});