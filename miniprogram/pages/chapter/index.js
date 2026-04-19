// chapter.js
const app = getApp();

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
    currentPlayingId: '',
    // 用于追踪播放列表状态
    playlistState: {
      courseId: '',
      showUnfinishedOnly: false,
      sortOrder: 'asc'
    }
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

    // 注册播放器回调
    this.audioCallback = {
      onClose: () => {
        // 播放器关闭，重置所有章节的播放状态
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: false })),
          currentPlayingId: ''
        });
        this.applyFilterAndSort();
      },
      onStop: () => {
        // 播放停止（包括清空播放列表），重置所有章节的播放状态
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: false })),
          currentPlayingId: ''
        });
        this.applyFilterAndSort();
      },
      onChapterChange: (data) => {
        // 播放章节切换，更新播放状态
        const { chapterId } = data;
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId })),
          currentPlayingId: chapterId
        });
        this.applyFilterAndSort();
      },
      onPlayPause: (data) => {
        // 播放/暂停状态变化（仅影响当前播放章节的显示状态）
        const { chapterId, isPlaying } = data;
        // 暂时不处理，章节页的 isPlaying 用于标识当前播放章节
        // 如果需要显示暂停状态，可以添加 isPaused 字段
      },
      onProgressUpdate: (data) => {
        // 进度更新，实时显示
        const { chapterId, lastPlayTime, finished } = data;
        const chapters = this.data.chapters.map(ch => {
          if (ch._id === chapterId) {
            // 如果本次设置为完播，更新为"已学完"
            if (finished === true) {
              return { ...ch, lastPlayTime, finished: true, progress: 100, progressText: '已学完' };
            }
            // 如果之前已完播，保持"已学完"状态，只更新 lastPlayTime
            if (ch.finished) {
              return { ...ch, lastPlayTime };
            }
            // 未完播时，根据播放位置计算进度
            const chDuration = Number(ch.duration) || 0;
            const progress = chDuration > 0 ? Math.min(Math.round((lastPlayTime / chDuration) * 100), 100) : 0;
            let progressText = '未学习';
            if (progress === 100) progressText = '已学完';
            else if (progress > 0) progressText = '已学' + progress + '%';
            return { ...ch, lastPlayTime, progress, progressText };
          }
          return ch;
        });

        // 计算课程总进度（章节平均进度）
        const courseProgress = chapters.length > 0
          ? Math.round(chapters.reduce((sum, ch) => sum + (ch.progress || 0), 0) / chapters.length)
          : 0;
        const courseProgressText = courseProgress === 100 ? '已学完'
          : courseProgress === 0 ? '未学习'
          : '已学' + courseProgress + '%';

        this.setData({
          chapters,
          filteredChapters: chapters,
          course: { ...this.data.course, progress: courseProgress, progressText: courseProgressText }
        });
      }
    };
    app.registerMiniPlayer(this.audioCallback);

    this.loadCourseData();
  },

  onReady() {
    this.calculateListMinHeight();
  },

  onShow() {
    // mini-player 会自动处理位置
    // 重新加载课程数据以同步收藏状态
    if (this.data.courseId) {
      this.loadCourseData();
    }
  },

  onUnload() {
    // 页面卸载时移除回调
    app.unregisterMiniPlayer(this.audioCallback);
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
        courseId: this.data.courseId,
        userId: app.globalData.userId
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

    // 从全局数据获取当前播放的章节ID
    const playingChapterId = app.globalData.playingChapter?._id || '';

    return {
      ...chapter,
      progress,
      progressText,
      durationText: this.formatDuration(duration),
      isPlaying: playingChapterId === chapter._id,
      isFavorite: chapter.isFavorite || false  // 保留云函数返回的收藏状态
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
    // 从当前筛选后的章节列表中选择播放
    const filteredChapters = this.data.filteredChapters;
    if (filteredChapters.length === 0) {
      wx.showToast({ title: '暂无章节', icon: 'none' });
      return;
    }

    // 找到进度最高的未学完章节
    const unfinished = filteredChapters.filter(ch => ch.progress < 100);
    if (unfinished.length > 0) {
      const target = unfinished.reduce((max, ch) => ch.progress > max.progress ? ch : max, unfinished[0]);
      this.playChapter(target._id);
    } else {
      // 如果全部学完，播放第一章
      this.playChapter(filteredChapters[0]._id);
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
    if (chapter?.isPlaying) {
      // 正在播放的章节，切换暂停/播放状态
      const miniPlayer = this.selectComponent('#miniPlayer');
      if (miniPlayer) miniPlayer.togglePlayPause();
    } else {
      this.playChapter(id);
    }
  },

  onPlayTap(e) {
    const id = e.currentTarget.dataset.id;
    const chapter = this.data.chapters.find(ch => ch._id === id);
    if (chapter?.isPlaying) {
      // 正在播放的章节，切换暂停/播放状态
      const miniPlayer = this.selectComponent('#miniPlayer');
      if (miniPlayer) miniPlayer.togglePlayPause();
    } else {
      this.playChapter(id);
    }
  },

  playChapter(chapterId) {
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) {
      // 检查播放列表状态是否变化，变化则重新生成播放列表
      const currentPlaylistState = {
        courseId: this.data.courseId,
        showUnfinishedOnly: this.data.showUnfinishedOnly,
        sortOrder: this.data.sortOrder
      };

      const stateChanged =
        currentPlaylistState.courseId !== this.data.playlistState.courseId ||
        currentPlaylistState.showUnfinishedOnly !== this.data.playlistState.showUnfinishedOnly ||
        currentPlaylistState.sortOrder !== this.data.playlistState.sortOrder;

      if (stateChanged) {
        // 状态变化，更新播放列表状态并传递新的播放列表
        this.setData({ playlistState: currentPlaylistState });
      }

      // 传递当前筛选后的章节列表作为播放列表
      miniPlayer.play(chapterId, this.data.filteredChapters, this.data.course, this.data.sortOrder);
    }

    this.setData({
      chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId })),
      currentPlayingId: chapterId
    });
    this.applyFilterAndSort();
  },

  onFavoriteTap(e) {
    const chapterId = e.currentTarget.dataset.id;
    const chapter = this.data.chapters.find(ch => ch._id === chapterId);
    const currentIsFavorite = chapter?.isFavorite || false;

    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'toggleFavorite',
        chapterId: chapterId,
        courseId: this.data.courseId,
        userId: app.globalData.userId
      }
    }).then(res => {
      if (res.result.success) {
        const newIsFavorite = res.result.isFavorite;
        // 更新章节列表中的收藏状态
        this.setData({
          chapters: this.data.chapters.map(ch =>
            ch._id === chapterId ? { ...ch, isFavorite: newIsFavorite } : ch
          )
        });
        this.applyFilterAndSort();
        wx.showToast({
          title: newIsFavorite ? '已收藏' : '已取消收藏',
          icon: 'none'
        });
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('收藏操作失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  }
});