// chapter.js
Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    listMinHeight: 0,
    courseId: '',
    course: {},
    chapters: [],
    filteredChapters: [],
    showUnfinishedOnly: false,
    sortOrder: 'asc',
    loading: true,
    currentPlayingId: ''
  },

  onLoad(options) {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    const headerHeight = windowInfo.statusBarHeight + navBarHeight;

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: headerHeight,
      courseId: options.id || ''
    });

    this.loadCourseData();
  },

  onReady() {
    this.calculateListMinHeight();
  },

  onShow() {
    // mini-player 会自动处理位置
  },

  calculateListMinHeight() {
    const query = wx.createSelectorQuery();
    query.select('.course-info-section').boundingClientRect();
    query.select('.filter-bar').boundingClientRect();
    query.exec((res) => {
      const windowInfo = wx.getWindowInfo();
      const headerHeight = this.data.headerHeight;
      const courseInfoHeight = res[0]?.height || 120;
      const filterBarHeight = res[1]?.height || 30;
      const minHeight = windowInfo.windowHeight - headerHeight - courseInfoHeight - filterBarHeight;
      this.setData({ listMinHeight: minHeight });
    });
  },

  loadCourseData() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'getCourseDetail',
        courseId: this.data.courseId
      }
    })
    .then(res => {
      if (res.result.success) {
        this.setData({
          course: res.result.course,
          chapters: res.result.chapters.map(ch => this.formatChapter(ch)),
          filteredChapters: res.result.chapters.map(ch => this.formatChapter(ch)),
          loading: false
        });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    })
    .catch(err => {
      console.error('加载课程数据失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  formatChapter(chapter) {
    const lastPlayTime = Number(chapter.lastPlayTime) || 0;
    const duration = Number(chapter.duration) || 0;
    const finished = chapter.finished === true;

    // 完播=true，进度为100%
    let progress = 0;
    if (finished) {
      progress = 100;
    } else if (lastPlayTime === 0) {
      progress = 0;
    } else if (lastPlayTime > 0 && duration > 0) {
      progress = Math.min(Math.round((lastPlayTime / duration) * 100), 100);
    }

    let progressText = '未学习';
    if (progress === 100) progressText = '已学完';
    else if (progress > 0) progressText = '已学' + progress + '%';

    return {
      ...chapter,
      progress,
      progressText,
      durationText: this.formatDuration(duration),
      isPlaying: this.data.currentPlayingId === chapter._id,
      isFavorite: false
    };
  },

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  handleBack() {
    wx.navigateBack({ delta: 1 });
  },

  handleContinuePlay() {
    const unfinished = this.data.chapters.filter(ch => ch.progress < 100);
    if (unfinished.length > 0) {
      const target = unfinished.reduce((max, ch) => ch.progress > max.progress ? ch : max, unfinished[0]);
      this.playChapter(target._id);
    } else if (this.data.chapters.length > 0) {
      this.playChapter(this.data.chapters[0]._id);
    } else {
      wx.showToast({ title: '暂无章节', icon: 'none' });
    }
  },

  onFilterChange(e) {
    this.setData({ showUnfinishedOnly: e.detail.value });
    this.applyFilterAndSort();
  },

  onSortChange() {
    this.setData({ sortOrder: this.data.sortOrder === 'asc' ? 'desc' : 'asc' });
    this.applyFilterAndSort();
  },

  applyFilterAndSort() {
    let chapters = [...this.data.chapters];

    if (this.data.showUnfinishedOnly) {
      chapters = chapters.filter(ch => ch.progress < 100);
    }

    chapters.sort((a, b) => {
      const diff = (a.seq || 0) - (b.seq || 0);
      return this.data.sortOrder === 'asc' ? diff : -diff;
    });

    this.setData({ filteredChapters: chapters });
  },

  onChapterTap(e) {
    const id = e.currentTarget.dataset.id;
    const chapter = this.data.chapters.find(ch => ch._id === id);
    if (chapter?.isPlaying) return; // 正在播放，不响应点击
    this.playChapter(id);
  },

  onPlayTap(e) {
    const id = e.currentTarget.dataset.id;
    const chapter = this.data.chapters.find(ch => ch._id === id);
    if (chapter?.isPlaying) return; // 正在播放，不响应点击
    this.playChapter(id);
  },

  playChapter(chapterId) {
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) miniPlayer.play(chapterId);

    this.setData({
      chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId })),
      currentPlayingId: chapterId
    });
    this.applyFilterAndSort();
  },

  onFavoriteTap(e) {
    wx.showToast({ title: '收藏功能开发中', icon: 'none' });
  }
});