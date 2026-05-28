// chapter.js
const app = getApp();

Page({
  data: {
    courseId: '',
    course: {},
    chapters: [],
    filteredChapters: [],
    showUnfinishedOnly: false,
    sortOrder: 'asc',
    loading: true,
    coverLoadTime: 0,
    playlistState: { courseId: '', showUnfinishedOnly: false, sortOrder: 'asc' },
    hasPlaylist: false, // 当前课程是否有播放列表（用于决定显示哪个按钮）
    isPlaying: false, // 当前是否正在播放
    headerHeight: 0,
    scrollHeight: 0
  },

  onLoad(options) {
    this.initLayout();
    this.setData({
      courseId: options.id || ''
    });

    this.audioCallback = {
      onClose: ({ chapterId }) => {
        if (chapterId) this.setData({ lastPlayedChapterId: chapterId });
        this.resetPlayingState();
      },
      onStop: ({ chapterId }) => {
        if (chapterId) this.setData({ lastPlayedChapterId: chapterId });
        this.resetPlayingState();
      },
      onPlay: () => {
        const cur = this.isCurrentCourse(this.data.courseId);
        this.setData({ hasPlaylist: cur, isPlaying: cur });
      },
      onPause: () => {
        if (this.isCurrentCourse(this.data.courseId)) {
          this.setData({ isPlaying: false });
        }
      },
      onChapterChange: ({ chapterId, isPlaying }) => {
        const cur = this.isCurrentCourse(this.data.courseId);
        const miniPlayerActive = app.globalData.miniPlayerActive;
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId })),
          hasPlaylist: cur && miniPlayerActive,
          isPlaying: isPlaying !== undefined ? isPlaying : (cur && miniPlayerActive)
        });
        this.applyFilterAndSort();
        this.saveCourseSettings({ lastPlayedChapterId: chapterId });
      },
      onProgressUpdate: ({ chapterId, lastPlayTime, finished }) => {
        const chapters = this.data.chapters.map(ch => {
          if (ch._id !== chapterId) return ch;
          if (ch.finished && finished !== true) return { ...ch, lastPlayTime };
          const duration = Number(ch.duration) || 0;
          let progress = 0;
          if (finished === true) progress = 100;
          else if (lastPlayTime > 0 && duration > 0) progress = Math.min(Math.round((lastPlayTime / duration) * 100), 100);
          const progressText = progress === 100 ? '已学完' : progress > 0 ? `已学${progress}%` : '未学习';
          return { ...ch, lastPlayTime, finished: finished === true, progress, progressText };
        });
        const courseProgress = chapters.length ? Math.round(chapters.reduce((s, c) => s + (c.progress || 0), 0) / chapters.length) : 0;
        this.setData({
          chapters,
          course: { ...this.data.course, progress: courseProgress, progressText: courseProgress === 100 ? '已学完' : courseProgress ? `已学${courseProgress}%` : '未学习' }
        });
        this.applyFilterAndSort();
      },
      onFavoriteChange: ({ chapterId, isFavorite }) => {
        this.setData({ chapters: this.data.chapters.map(ch => ch._id === chapterId ? { ...ch, isFavorite } : ch) });
        this.applyFilterAndSort();
      }
    };
    app.registerMiniPlayer(this.audioCallback);
    this.coverCallback = {
      onCoverRefresh: ({ coverLoadTime }) => {
        if (coverLoadTime && coverLoadTime !== this.data.coverLoadTime) {
          this.setData({ coverLoadTime });
          if (this.data.course.cover) {
            this.setData({ course: { ...this.data.course, cover: this.processImageUrl(this.data.course.cover) } });
          }
        }
      }
    };
    app.registerMiniPlayer(this.coverCallback);
    this.loadCourseData();
  },

  onShow() {
    if (this.data.courseId) {
      this.loadCourseData();
    }
    // 同步图片时间戳变化
    this.syncImageTimes();
    // 同步播放状态
    this.updatePlayingState();
  },

  // 更新当前播放状态
  updatePlayingState() {
    const cur = this.isCurrentCourse(this.data.courseId);
    this.setData({
      hasPlaylist: cur && app.globalData.playlistChaptersData?.length > 0,
      isPlaying: !app.bgAudioManager.paused && cur
    });
  },

  // 同步图片时间戳（其他页面刷新后返回需要更新图片）
  syncImageTimes() {
    const ct = app.globalData.coverLoadTime;
    if (ct && ct !== this.data.coverLoadTime) {
      this.setData({ coverLoadTime: ct });
      if (this.data.course.cover) {
        this.setData({ course: { ...this.data.course, cover: this.processImageUrl(this.data.course.cover) } });
      }
    }
  },

  initLayout() {
    const { statusBarHeight, windowHeight, windowWidth } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    this.setData({
      headerHeight,
      scrollHeight: windowHeight - headerHeight
    });
  },

  onUnload() {
    app.unregisterMiniPlayer(this.audioCallback);
    app.unregisterMiniPlayer(this.coverCallback);
  },

  // 判断指定课程ID是否为当前播放课程
  isCurrentCourse(courseId) {
    return app.globalData.playingCourse?._id === courseId;
  },

  resetPlayingState() {
    const chapters = this.data.chapters.map(ch => ({ ...ch, isPlaying: false }));
    this.setData({ chapters, hasPlaylist: false, isPlaying: false });
    this.applyFilterAndSort();
  },

  loadCourseData() {
    // 先获取用户课程偏好设置
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourseSettings', courseId: this.data.courseId, userId: app.globalData.userId }
    }).then(settingsRes => {
      // 获取设置失败时使用默认值
      const userSettings = (settingsRes.result && settingsRes.result.success) ? settingsRes.result.data : { sortOrder: 'asc', showUnfinishedOnly: false, lastPlayedChapterId: null };

      // 然后获取课程详情
      return wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'getCourseDetail', courseId: this.data.courseId, userId: app.globalData.userId }
      }).then(res => {
        if (res.result.success) {
          const course = res.result.course;
          course.cover = this.processImageUrl(course.cover);
          const chapters = res.result.chapters.map(ch => this.formatChapter(ch));
          this.setData({
            course,
            chapters,
            filteredChapters: chapters,
            sortOrder: userSettings.sortOrder,
            showUnfinishedOnly: userSettings.showUnfinishedOnly,
            lastPlayedChapterId: userSettings.lastPlayedChapterId,
            loading: false
          });
          this.applyFilterAndSort();
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
          this.setData({ loading: false });
        }
      });
    }).catch(err => {
      console.error('加载课程数据失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  processImageUrl(url) {
    if (!url || url.includes('seed/fixed_')) return url;
    const t = app.globalData.coverLoadTime || this.data.coverLoadTime;
    if (!t) return url; // 时间戳未初始化时不处理
    const m1 = url.match(/seed\/(\d+)_cover_/);
    if (m1) return m1[1] != t ? url.replace(/seed\/\d+_cover_/, `seed/${t}_cover_`) : url;
    const m2 = url.match(/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
    if (m2) return `https://picsum.photos/seed/${t}_cover_${m2[1]}/${m2[2]}`;
    const m3 = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
    if (m3) return `https://picsum.photos/seed/${t}_cover_${url.match(/random=(\d+)/)?.[1] || 0}/${m3[1]}`;
    return url;
  },

  formatChapter(chapter) {
    const lastPlayTime = Number(chapter.lastPlayTime) || 0;
    const duration = Number(chapter.duration) || 0;
    const finished = chapter.finished === true;
    let progress = finished ? 100 : (lastPlayTime > 0 && duration > 0 ? Math.min(Math.round((lastPlayTime / duration) * 100), 100) : 0);
    let progressText = progress === 100 ? '已学完' : progress > 0 ? `已学${progress}%` : '未学习';
    return {
      ...chapter,
      progress,
      progressText,
      durationText: duration > 0 ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '--',
      isPlaying: app.globalData.playingChapter?._id === chapter._id,
      isFavorite: chapter.isFavorite || false,
      // 注入课程信息，供 mini-player 使用
      courseTitle: chapter.courseTitle || this.data.course.title || '',
      courseCover: chapter.courseCover || this.data.course.cover || '',
      author: chapter.author || this.data.course.author || ''
    };
  },

  handlePlay() {
    // 有播放列表时切换播放/暂停，没有播放列表时创建并播放
    if (this.data.hasPlaylist) {
      app.togglePlayPause();
    } else {
      // 创建完整播放列表（使用全部章节，不受筛选影响）
      const { courseId, chapters, course } = this.data;
      if (!courseId || !chapters.length) {
        return wx.showToast({ title: '暂无章节', icon: 'none' });
      }

      // 找到第一个未完成的章节
      let chapterToPlay = chapters.find(ch => ch.progress < 100) || chapters[0];

      // 调用 miniPlayer.play 来显示 mini-player UI 并开始播放
      const miniPlayer = this.selectComponent('#miniPlayer');
      if (miniPlayer) {
        miniPlayer.play(chapterToPlay._id, chapters, course, 'asc');
      }

      this.setData({
        hasPlaylist: true,
        isPlaying: true
      });
    }
  },

  onFilterChange(e) {
    const showUnfinishedOnly = e.detail.value;
    this.setData({ showUnfinishedOnly });
    this.applyFilterAndSort();
    this.saveCourseSettings({ showUnfinishedOnly });
  },

  onSortChange() {
    const sortOrder = this.data.sortOrder === 'asc' ? 'desc' : 'asc';
    this.setData({ sortOrder });
    this.applyFilterAndSort();
    this.saveCourseSettings({ sortOrder });
  },

  saveCourseSettings(settings) {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'updateCourseSettings',
        courseId: this.data.courseId,
        userId: app.globalData.userId,
        ...settings
      }
    });
  },

  applyFilterAndSort() {
    let chapters = [...this.data.chapters];
    if (this.data.showUnfinishedOnly) chapters = chapters.filter(ch => ch.progress < 100);
    chapters.sort((a, b) => (this.data.sortOrder === 'asc' ? (a.seq || 0) - (b.seq || 0) : (b.seq || 0) - (a.seq || 0)));
    this.setData({ filteredChapters: chapters });
  },

  onChapterTap(e) {
    this.playChapter(e.currentTarget.dataset.id);
  },

  playChapter(chapterId) {
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) {
      miniPlayer.play(chapterId, this.data.filteredChapters, this.data.course, this.data.sortOrder);
    }
    this.setData({ chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId })) });
    this.applyFilterAndSort();
    // 保存最近播放的章节ID
    this.saveCourseSettings({ lastPlayedChapterId: chapterId });
  },

  onBack() {
    wx.navigateBack({ fail: () => {
      wx.reLaunch({ url: '/pages/index/index' });
    }});
  },

  onFavoriteTap(e) {
    const chapterId = e.currentTarget.dataset.id;
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'toggleFavorite', chapterId, courseId: this.data.courseId, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) {
        const newIsFavorite = res.result.data.isFavorite;
        this.setData({ chapters: this.data.chapters.map(ch => ch._id === chapterId ? { ...ch, isFavorite: newIsFavorite } : ch) });
        this.applyFilterAndSort();
        wx.showToast({ title: newIsFavorite ? '已收藏' : '已取消收藏', icon: 'none' });
      } else wx.showToast({ title: '操作失败', icon: 'none' });
    }).catch(err => {
      console.error('收藏操作失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  }
});