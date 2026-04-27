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
    isCurrentCoursePlaying: false, // 当前课程是否正在播放
    isCurrentChapterPlaying: false // 当前章节是否正在播放
  },

  onLoad(options) {
    this.setData({
      courseId: options.id || ''
    });

    this.audioCallback = {
      onClose: ({ chapterId }) => {
        if (chapterId) {
          this.setData({ lastPlayedChapterId: chapterId });
        }
        this.resetPlayingState();
      },
      onStop: ({ chapterId }) => {
        if (chapterId) {
          this.setData({ lastPlayedChapterId: chapterId });
        }
        this.resetPlayingState();
      },
      onPlayPause: ({ isPlaying }) => {
        // 根据实际播放状态更新按钮样式
        const playingCourseId = app.globalData.playingCourse?._id;
        const isCurrentCourse = playingCourseId === this.data.courseId;
        const chapterId = app.globalData.playingChapter?._id;
        this.setData({
          isCurrentCoursePlaying: isCurrentCourse && isPlaying,
          isCurrentChapterPlaying: isCurrentCourse && isPlaying,
          lastPlayedChapterId: !isPlaying && chapterId ? chapterId : this.data.lastPlayedChapterId
        });
        // 暂停时保存当前章节到数据库
        if (!isPlaying && chapterId) {
          this.saveCourseSettings({ lastPlayedChapterId: chapterId });
        }
      },
      onChapterChange: ({ chapterId }) => {
        const playingCourseId = app.globalData.playingCourse?._id;
        const isCurrentCourse = playingCourseId === this.data.courseId;
        const miniPlayerActive = app.globalData.miniPlayerActive;
        // 检查 chapterId 是否属于当前课程
        const isCurrentChapter = isCurrentCourse && chapterId && this.data.chapters.some(ch => ch._id === chapterId);
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId })),
          isCurrentCoursePlaying: isCurrentCourse && miniPlayerActive,
          isCurrentChapterPlaying: isCurrentChapter && miniPlayerActive
        });
        this.applyFilterAndSort();
        // 保存最近播放的章节ID
        this.saveCourseSettings({ lastPlayedChapterId: chapterId });
      },
      onProgressUpdate: ({ chapterId, lastPlayTime, finished }) => {
        const chapters = this.data.chapters.map(ch => {
          if (ch._id !== chapterId) return ch;
          if (finished === true) return { ...ch, lastPlayTime, finished: true, progress: 100, progressText: '已学完' };
          if (ch.finished) return { ...ch, lastPlayTime };
          const progress = ch.duration > 0 ? Math.min(Math.round((lastPlayTime / ch.duration) * 100), 100) : 0;
          const progressText = progress === 100 ? '已学完' : progress > 0 ? `已学${progress}%` : '未学习';
          return { ...ch, lastPlayTime, progress, progressText };
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
    // 不再每次都 loadCourseData，只在首次加载或需要刷新数据时
    if (this.data.courseId && this.data.chapters.length === 0) {
      this.loadCourseData();
    } else {
      // 保持现有数据，只更新进度等动态信息
      this.applyFilterAndSort();
    }
    // 同步图片时间戳变化
    this.syncImageTimes();
    // 同步播放状态
    this.updatePlayingState();
    // 刷新用户设置（如上次播放章节）
    this.reloadCourseSettings();
  },

  reloadCourseSettings() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourseSettings', courseId: this.data.courseId, userId: app.globalData.userId }
    }).then(settingsRes => {
      if (settingsRes.result && settingsRes.result.success) {
        const { sortOrder, showUnfinishedOnly, lastPlayedChapterId } = settingsRes.result.data;
        this.setData({
          sortOrder: sortOrder || 'asc',
          showUnfinishedOnly: showUnfinishedOnly || false,
          lastPlayedChapterId: lastPlayedChapterId || null
        });
        this.applyFilterAndSort();
      }
    });
  },

  // 更新当前播放状态
  updatePlayingState() {
    const playingCourseId = app.globalData.playingCourse?._id;
    const playingChapterId = app.globalData.playingChapter?._id;
    const isCurrentCourse = playingCourseId === this.data.courseId;
    const isCurrentChapter = isCurrentCourse && playingChapterId && this.data.chapters.some(ch => ch._id === playingChapterId && ch.isPlaying);
    this.setData({
      isCurrentCoursePlaying: isCurrentCourse && app.globalData.miniPlayerActive,
      isCurrentChapterPlaying: isCurrentChapter
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

  onUnload() {
    app.unregisterMiniPlayer(this.audioCallback);
    app.unregisterMiniPlayer(this.coverCallback);
  },

  resetPlayingState() {
    this.setData({
      chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: false })),
      isCurrentCoursePlaying: false,
      isCurrentChapterPlaying: false
    });
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
      isFavorite: chapter.isFavorite || false
    };
  },

  handlePausePlay() {
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) {
      miniPlayer.togglePlayPause();
    }
  },

  handleContinuePlay() {
    const { filteredChapters, lastPlayedChapterId, showUnfinishedOnly } = this.data;

    // 如果只看未学完且没有未学完的章节
    if (showUnfinishedOnly && filteredChapters.length === 0) {
      return wx.showToast({ title: '所有章节已学完', icon: 'none' });
    }

    if (!filteredChapters.length) {
      return wx.showToast({ title: '暂无章节', icon: 'none' });
    }

    let chapterToPlay = null;

    // 优先使用上次播放的章节
    if (lastPlayedChapterId) {
      chapterToPlay = filteredChapters.find(ch => ch._id === lastPlayedChapterId);
    }

    // 如果找不到上次播放的章节（可能被删除了），使用第一个
    if (!chapterToPlay) {
      chapterToPlay = filteredChapters[0];
    }

    this.playChapter(chapterToPlay._id);
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

  onPlayTap(e) {
    this.playChapter(e.currentTarget.dataset.id);
  },

  playChapter(chapterId) {
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) {
      const state = { courseId: this.data.courseId, showUnfinishedOnly: this.data.showUnfinishedOnly, sortOrder: this.data.sortOrder };
      if (state.courseId !== this.data.playlistState.courseId || state.showUnfinishedOnly !== this.data.playlistState.showUnfinishedOnly || state.sortOrder !== this.data.playlistState.sortOrder) {
        this.setData({ playlistState: state });
      }
      miniPlayer.play(chapterId, this.data.filteredChapters, this.data.course, this.data.sortOrder);
    }
    this.setData({ chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId })) });
    this.applyFilterAndSort();
    // 保存最近播放的章节ID
    this.saveCourseSettings({ lastPlayedChapterId: chapterId });
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