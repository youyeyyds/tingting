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
    hasPlaylist: false,
    isPlaying: false
  },

  onLoad(options) {
    this.setData({ courseId: options.id || '' });

    this.audioCallback = {
      onClose: () => this.resetPlayingState(),
      onStop: () => this.resetPlayingState(),
      onPlay: () => {
        console.log('[chapter] onPlay', { playingStatus: app.globalData.playingStatus });
        const isCurrentCourse = app.globalData.playingCourse?._id === this.data.courseId;
        this.setData({ hasPlaylist: isCurrentCourse, isPlaying: isCurrentCourse });
      },
      onPause: () => {
        console.log('[chapter] onPause', { playingStatus: app.globalData.playingStatus });
        this.setData({ isPlaying: false });
      },
      onChapterChange: ({ chapterId }) => {
        console.log('[chapter] onChapterChange', { chapterId, playingStatus: app.globalData.playingStatus });
        const isCurrentCourse = app.globalData.playingCourse?._id === this.data.courseId;
        const miniPlayerActive = app.globalData.miniPlayerActive;
        const chapters = this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId }));
        this.setData({
          chapters,
          filteredChapters: this._applyFilterAndSort(chapters),
          hasPlaylist: isCurrentCourse && miniPlayerActive,
          isPlaying: isCurrentCourse && miniPlayerActive
        });
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
        const progressText = courseProgress === 100 ? '已学完' : courseProgress ? `已学${courseProgress}%` : '未学习';
        this.setData({
          chapters,
          filteredChapters: this._applyFilterAndSort(chapters),
          course: { ...this.data.course, progress: courseProgress, progressText }
        });
      },
      onFavoriteChange: ({ chapterId, isFavorite }) => {
        const chapters = this.data.chapters.map(ch => ch._id === chapterId ? { ...ch, isFavorite } : ch);
        this.setData({ chapters, filteredChapters: this._applyFilterAndSort(chapters) });
      }
    };
    app.registerMiniPlayer(this.audioCallback);
    this.coverCallback = {
      onCoverRefresh: ({ coverLoadTime }) => {
        if (coverLoadTime && coverLoadTime !== this.data.coverLoadTime) {
          this.setData({ coverLoadTime });
          if (this.data.course.cover) {
            this.setData({ course: { ...this.data.course, cover: app.processImageUrl(this.data.course.cover) } });
          }
        }
      }
    };
    app.registerMiniPlayer(this.coverCallback);
    this.loadCourseData();
  },

  onShow() {
    if (this.data.courseId && this.data.chapters.length === 0) {
      this.loadCourseData();
    } else {
      this.applyFilterAndSort();
    }
    this.syncImageTimes();
    this.updatePlayingState();
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

  updatePlayingState() {
    console.log('[chapter] updatePlayingState', { playingStatus: app.globalData.playingStatus });
    const isCurrentCourse = app.globalData.playingCourse?._id === this.data.courseId;
    const isPlaying = isCurrentCourse && app.globalData.playingStatus;
    this.setData({ hasPlaylist: isCurrentCourse && app.globalData.playlistChaptersData?.length > 0, isPlaying });
  },

  syncImageTimes() {
    const ct = app.globalData.coverLoadTime;
    if (ct && ct !== this.data.coverLoadTime) {
      this.setData({ coverLoadTime: ct });
      if (this.data.course.cover) {
        this.setData({ course: { ...this.data.course, cover: app.processImageUrl(this.data.course.cover) } });
      }
    }
  },

  onUnload() {
    app.unregisterMiniPlayer(this.audioCallback);
    app.unregisterMiniPlayer(this.coverCallback);
  },

  resetPlayingState() {
    const chapters = this.data.chapters.map(ch => ({ ...ch, isPlaying: false }));
    this.setData({ chapters, filteredChapters: this._applyFilterAndSort(chapters), hasPlaylist: false, isPlaying: false });
  },

  loadCourseData() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourseSettings', courseId: this.data.courseId, userId: app.globalData.userId }
    }).then(settingsRes => {
      const userSettings = settingsRes.result?.success ? settingsRes.result.data : { sortOrder: 'asc', showUnfinishedOnly: false, lastPlayedChapterId: null };
      return wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'getCourseDetail', courseId: this.data.courseId, userId: app.globalData.userId }
      }).then(res => {
        if (res.result.success) {
          const course = res.result.course;
          course.cover = app.processImageUrl(course.cover);
          const chapters = res.result.chapters.map(ch => this.formatChapter(ch));
          this.setData({
            course, chapters, filteredChapters: chapters,
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

  formatChapter(chapter) {
    const lastPlayTime = Number(chapter.lastPlayTime) || 0;
    const duration = Number(chapter.duration) || 0;
    const finished = chapter.finished === true;
    const progress = finished ? 100 : (lastPlayTime > 0 && duration > 0 ? Math.min(Math.round((lastPlayTime / duration) * 100), 100) : 0);
    const progressText = progress === 100 ? '已学完' : progress > 0 ? `已学${progress}%` : '未学习';
    return {
      ...chapter,
      progress,
      progressText,
      durationText: duration > 0 ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '--',
      isPlaying: app.globalData.playingChapter?._id === chapter._id,
      isFavorite: chapter.isFavorite || false
    };
  },

  handlePlayBtnTap() {
    if (this.data.hasPlaylist) {
      app.togglePlayPause();
    } else {
      this.handleCreatePlaylist();
    }
  },

  handleCreatePlaylist() {
    const { courseId, chapters, course, sortOrder, lastPlayedChapterId } = this.data;
    if (!courseId || !chapters.length) return wx.showToast({ title: '暂无章节', icon: 'none' });

    const sortedChapters = [...chapters].sort((a, b) => {
      const seqA = a.seq || 0, seqB = b.seq || 0;
      return sortOrder === 'asc' ? seqA - seqB : seqB - seqA;
    });

    let chapterToPlay = sortedChapters.find(ch => ch._id === lastPlayedChapterId) || sortedChapters.find(ch => ch.progress < 100) || sortedChapters[0];

    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) miniPlayer.play(chapterToPlay._id, sortedChapters, course, sortOrder);
    this.setData({ hasPlaylist: true, isPlaying: true });
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
      data: { type: 'updateCourseSettings', courseId: this.data.courseId, userId: app.globalData.userId, ...settings }
    });
  },

  _applyFilterAndSort(chapters) {
    let filtered = chapters || [...this.data.chapters];
    if (this.data.showUnfinishedOnly) filtered = filtered.filter(ch => ch.progress < 100);
    filtered.sort((a, b) => (this.data.sortOrder === 'asc' ? (a.seq || 0) - (b.seq || 0) : (b.seq || 0) - (a.seq || 0)));
    const currentPlayingId = app.globalData.playingChapter?._id;
    return filtered.map(ch => ({ ...ch, isPlaying: ch._id === currentPlayingId }));
  },

  applyFilterAndSort() {
    this.setData({ filteredChapters: this._applyFilterAndSort() });
  },

  onChapterTap(e) { this.playChapter(e.currentTarget.dataset.id); },
  onPlayTap(e) { this.playChapter(e.currentTarget.dataset.id); },

  playChapter(chapterId) {
    const chapters = this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId }));
    chapters.sort((a, b) => (this.data.sortOrder === 'asc' ? (a.seq || 0) - (b.seq || 0) : (b.seq || 0) - (a.seq || 0)));
    this.setData({ chapters, filteredChapters: this._applyFilterAndSort(chapters) });
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) miniPlayer.play(chapterId, chapters, this.data.course, this.data.sortOrder);
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
        const chapters = this.data.chapters.map(ch => ch._id === chapterId ? { ...ch, isFavorite: newIsFavorite } : ch);
        this.setData({ chapters, filteredChapters: this._applyFilterAndSort(chapters) });
        wx.showToast({ title: newIsFavorite ? '已收藏' : '已取消收藏', icon: 'none' });
      } else wx.showToast({ title: '操作失败', icon: 'none' });
    }).catch(() => wx.showToast({ title: '操作失败', icon: 'none' }));
  }
});