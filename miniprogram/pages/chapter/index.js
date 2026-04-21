// chapter.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    scrollHeight: 0, // scroll-view 高度
    refresherTriggered: false, // 下拉刷新状态
    listMinHeight: 0,
    courseId: '',
    course: {},
    chapters: [],
    filteredChapters: [],
    showUnfinishedOnly: false,
    sortOrder: 'asc',
    loading: true,
    currentPlayingId: '',
    loadTime: 0, // 横幅时间戳（封面只在首页刷新才更新）
    coverLoadTime: 0, // 封面时间戳（只在首页刷新才更新）
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
    // scroll-view 高度 = 屏幕高度 - header（迷你播放器是浮层，不占用空间）
    const scrollHeight = windowInfo.windowHeight - headerHeight;

    // 使用全局时间戳，保持图片稳定
    if (!app.globalData.bannerLoadTime) {
      app.globalData.bannerLoadTime = Date.now();
    }
    if (!app.globalData.coverLoadTime) {
      app.globalData.coverLoadTime = Date.now();
    }
    const loadTime = app.globalData.bannerLoadTime;
    const coverLoadTime = app.globalData.coverLoadTime;

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: headerHeight,
      scrollHeight: scrollHeight,
      courseId: options.id || '',
      loadTime: loadTime,
      coverLoadTime: coverLoadTime
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
      },
      onFavoriteChange: (data) => {
        // 收藏状态变化，同步更新章节列表
        const { chapterId, isFavorite } = data;
        this.setData({
          chapters: this.data.chapters.map(ch =>
            ch._id === chapterId ? { ...ch, isFavorite } : ch
          )
        });
        this.applyFilterAndSort();
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

  onRefresh() {
    // 章节页刷新不更新封面（封面只在首页刷新才更新）
    this.setData({ refresherTriggered: true });
    if (this.data.courseId) {
      this.loadCourseDataAsync().then(() => {
        this.setData({ refresherTriggered: false });
      });
    } else {
      this.setData({ refresherTriggered: false });
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
    this.loadCourseDataAsync();
  },

  loadCourseDataAsync() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'getCourseDetail',
        courseId: this.data.courseId,
        userId: app.globalData.userId
      }
    })
    .then(res => {
      if (res.result.success) {
        const course = res.result.course;
        // 处理课程封面图片
        course.cover = this.fixImageUrl(course.cover, 'cover');
        this.setData({
          course: course,
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

  // 固定图片URL，使用picsum的seed格式保证稳定但刷新时变化
  // 封面使用 coverLoadTime（只有首页刷新才更新）
  fixImageUrl(url, type = 'cover') {
    if (!url) return url;

    // 检查是否包含 _fixed_ 标记，表示固定图片，不替换时间戳
    if (url.includes('picsum.photos/seed/') && url.includes('_fixed_')) {
      return url; // 固定图片，直接返回
    }

    // 章节页只有封面，用 coverLoadTime
    const loadTime = this.data.coverLoadTime;

    // 检查URL是否已经包含时间戳格式的seed（如 123456_cover_xxx），说明已处理过
    if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_cover_/)) {
      return url; // 已处理过且是封面类型，直接返回
    }

    // 处理 picsum.photos URL
    if (url.includes('picsum.photos')) {
      // 如果已经是seed格式（非时间戳格式），替换seed为时间戳+类型+原seed组合
      // 格式: https://picsum.photos/seed/course1/400/400
      const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const originalSeed = seedMatch[1]; // 如 "course1"
        const size = seedMatch[2]; // 如 "400/400" 或 "400"
        const newSeed = `${loadTime}_${type}_${originalSeed}`;
        return `https://picsum.photos/seed/${newSeed}/${size}`;
      }

      // 提取尺寸信息，支持两种格式：
      // 格式1: https://picsum.photos/800/300?random=1
      // 格式2: https://picsum.photos/400?random=1
      const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
      const randomMatch = url.match(/random=(\d+)/);

      if (sizeMatch) {
        const size = sizeMatch[1]; // 如 "800/300" 或 "400"
        const originalRandom = randomMatch ? randomMatch[1] : '0';
        // 组合时间戳+类型+原始random作为种子
        const seed = `${loadTime}_${type}_${originalRandom}`;
        return `https://picsum.photos/seed/${seed}/${size}`;
      }
    }

    // 其他URL添加时间戳防缓存
    return this.addTimestamp(url);
  },

  // 添加时间戳到URL
  addTimestamp(url) {
    if (!url) return url;
    const t = this.data.coverLoadTime;
    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
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
        const newIsFavorite = res.result.data.isFavorite;
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