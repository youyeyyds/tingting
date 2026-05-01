// playlist-panel/index.js
const app = getApp();

Component({
  properties: {
    chapters: {
      type: Array,
      value: [],
      observer: function(newVal) {
        // chapters 变化时，更新 sortedChapters
        if (newVal && newVal.length > 0) {
          // 拖拽进行中 或 chapters 已有 index：直接用 newVal 更新，跳过 applySort
          if (this.data.isDragging || newVal[0].index !== undefined) {
            const currentId = this.properties.currentChapterId;
            const updated = newVal.map((ch, idx) => ({ ...ch, index: idx, isPlaying: ch._id === currentId }));
            this.setData({ sortedChapters: updated, hasInitialized: true });
          } else {
            // chapters 没有 index 时（来自 chapter 页的fresh数据），始终重新排序
            // 这样关闭播放器再点击章节卡片时，列表会重置为原始顺序
            this.applySort();
            this.setData({ hasInitialized: true });
          }
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
    initialSortOrder: {
      type: String,
      value: 'asc',
      observer: function(newVal) {
        if (newVal && newVal !== this.data.sortOrder) {
          this.setData({ sortOrder: newVal }, () => {
            this.applySort();
          });
        }
      }
    },
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
    confirmVisible: false,
    justDragEnded: false, // 标记刚结束拖拽，防止触发 onCardTap
    isDragging: false, // 标记正在拖拽，防止 observer 重复排序
    hasInitialized: false // 标记是否已初始化，初始化前由 observer 处理，之后不再重复排序
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
      // 如果 sortedChapters 已有数据，直接用，不再重复排序
      if (this.data.sortedChapters.length > 0) {
        this.setData({ visible: true, slideClass: 'slide-up' });
        setTimeout(() => this.scrollToCurrent(), 350);
        return;
      }
      // sortedChapters 为空时，不调用 applySort，让 observer 处理
      // observer 会检测 chapters 是否有 index，没有则调用 applySort
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
      // 如果 chapters 已有 index，说明已经排过序，跳过
      if (this.properties.chapters && this.properties.chapters.length > 0 && this.properties.chapters[0].index !== undefined) {
        return;
      }
      let chapters = [...this.properties.chapters];
      const currentId = this.properties.currentChapterId;
      const sortOrder = this.data.sortOrder || 'asc';

      // 收藏列表按原始顺序排列（不按 seq 排序）
      // 排序按钮只是切换显示顺序（正序/倒序），不改变播放顺序
      if (this.properties.isFavoriteList) {
        if (sortOrder === 'desc') {
          chapters.reverse();
        }
      } else {
        // 课程列表按 seq 排序
        chapters.sort((a, b) => {
          const diff = (a.seq || 0) - (b.seq || 0);
          return sortOrder === 'asc' ? diff : -diff;
        });
      }

      chapters = chapters.map(ch => ({
        ...ch,
        isPlaying: ch._id === currentId
      }));
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
      // 直接反转 sortedChapters，保持拖拽后的顺序，只切换显示方向
      const reversed = [...this.data.sortedChapters].reverse().map((ch, idx) => ({
        ...ch,
        index: idx,
        isPlaying: ch._id === currentId
      }));
      this.setData({ sortOrder: newOrder, sortedChapters: reversed });
      app.globalData.playlistSortOrder = newOrder;
      // 收藏列表的排序只是视图展示切换，不同步回播放器
      if (!this.properties.isFavoriteList) {
        this.triggerEvent('syncSort', { chapters: reversed, sortOrder: newOrder });
      }
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
      // 如果刚结束拖拽，跳过此次点击
      if (this.data.justDragEnded) return;

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
        this.setData({
          sortedChapters: chapters,
          dragIndex: newIndex,
          startY: touch.clientY
        });
      }
    },

    onDragEnd() {
      const sortedChapters = this.data.sortedChapters;
      const sortOrder = this.data.sortOrder;
      // 拖拽后重新生成 index
      const withIndex = sortedChapters.map((ch, idx) => ({ ...ch, index: idx }));
      app.globalData.playlistChapters = withIndex.map(ch => ch._id);
      app.globalData.playlistChaptersData = withIndex;
      this.triggerEvent('syncSort', { chapters: withIndex, sortOrder });
      this.setData({ dragIndex: -1, justDragEnded: true }, () => {
        this.setData({ isDragging: false, justDragEnded: false });
      });
    },

    preventMove() {
      return true;
    },
  }
});