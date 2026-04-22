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
    playlistState: { courseId: '', showUnfinishedOnly: false, sortOrder: 'asc' }
  },

  onLoad(options) {
    this.setData({
      courseId: options.id || ''
    });

    this.audioCallback = {
      onClose: () => this.resetPlayingState(),
      onStop: () => this.resetPlayingState(),
      onChapterChange: ({ chapterId }) => {
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId }))
        });
        this.applyFilterAndSort();
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
          filteredChapters: chapters,
          course: { ...this.data.course, progress: courseProgress, progressText: courseProgress === 100 ? '已学完' : courseProgress ? `已学${courseProgress}%` : '未学习' }
        });
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
    if (this.data.courseId) this.loadCourseData();
  },

  onUnload() {
    app.unregisterMiniPlayer(this.audioCallback);
    app.unregisterMiniPlayer(this.coverCallback);
  },

  resetPlayingState() {
    this.setData({
      chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: false }))
    });
    this.applyFilterAndSort();
  },

  loadCourseData() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourseDetail', courseId: this.data.courseId, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) {
        const course = res.result.course;
        course.cover = this.processImageUrl(course.cover);
        this.setData({
          course,
          chapters: res.result.chapters.map(ch => this.formatChapter(ch)),
          filteredChapters: res.result.chapters.map(ch => this.formatChapter(ch)),
          loading: false
        });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
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

  handleContinuePlay() {
    const { filteredChapters } = this.data;
    if (!filteredChapters.length) return wx.showToast({ title: '暂无章节', icon: 'none' });
    const unfinished = filteredChapters.filter(ch => ch.progress < 100);
    this.playChapter(unfinished.length ? unfinished.reduce((max, ch) => ch.progress > max.progress ? ch : max, unfinished[0])._id : filteredChapters[0]._id);
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
    if (this.data.showUnfinishedOnly) chapters = chapters.filter(ch => ch.progress < 100);
    chapters.sort((a, b) => (this.data.sortOrder === 'asc' ? (a.seq || 0) - (b.seq || 0) : (b.seq || 0) - (a.seq || 0)));
    this.setData({ filteredChapters: chapters });
  },

  onChapterTap(e) {
    const chapter = this.data.chapters.find(ch => ch._id === e.currentTarget.dataset.id);
    if (chapter?.isPlaying) this.selectComponent('#miniPlayer')?.togglePlayPause?.();
    else this.playChapter(e.currentTarget.dataset.id);
  },

  onPlayTap(e) {
    const chapter = this.data.chapters.find(ch => ch._id === e.currentTarget.dataset.id);
    if (chapter?.isPlaying) this.selectComponent('#miniPlayer')?.togglePlayPause?.();
    else this.playChapter(e.currentTarget.dataset.id);
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