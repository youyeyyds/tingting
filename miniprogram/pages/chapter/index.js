// chapter.js
const app = getApp();

Page({
  data: {
    scrollHeight: 0,
    refresherTriggered: false,
    listMinHeight: 0,
    courseId: '',
    course: {},
    chapters: [],
    filteredChapters: [],
    showUnfinishedOnly: false,
    sortOrder: 'asc',
    loading: true,
    currentPlayingId: '',
    coverLoadTime: 0,
    playlistState: {
      courseId: '',
      showUnfinishedOnly: false,
      sortOrder: 'asc'
    }
  },

  onLoad(options) {
    const { windowHeight } = wx.getWindowInfo();
    this.setData({
      scrollHeight: windowHeight,
      courseId: options.id || '',
      coverLoadTime: app.globalData.coverLoadTime || Date.now()
    });

    this.audioCallback = {
      onClose: () => {
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: false })),
          currentPlayingId: ''
        });
        this.applyFilterAndSort();
      },
      onStop: () => {
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: false })),
          currentPlayingId: ''
        });
        this.applyFilterAndSort();
      },
      onChapterChange: (data) => {
        const { chapterId } = data;
        this.setData({
          chapters: this.data.chapters.map(ch => ({ ...ch, isPlaying: ch._id === chapterId })),
          currentPlayingId: chapterId
        });
        this.applyFilterAndSort();
      },
      onProgressUpdate: (data) => {
        const { chapterId, lastPlayTime, finished } = data;
        const chapters = this.data.chapters.map(ch => {
          if (ch._id === chapterId) {
            if (finished === true) {
              return { ...ch, lastPlayTime, finished: true, progress: 100, progressText: '已学完' };
            }
            if (ch.finished) return { ...ch, lastPlayTime };
            const chDuration = Number(ch.duration) || 0;
            const progress = chDuration > 0 ? Math.min(Math.round((lastPlayTime / chDuration) * 100), 100) : 0;
            let progressText = '未学习';
            if (progress === 100) progressText = '已学完';
            else if (progress > 0) progressText = '已学' + progress + '%';
            return { ...ch, lastPlayTime, progress, progressText };
          }
          return ch;
        });
        const courseProgress = chapters.length > 0
          ? Math.round(chapters.reduce((sum, ch) => sum + (ch.progress || 0), 0) / chapters.length)
          : 0;
        const courseProgressText = courseProgress === 100 ? '已学完'
          : courseProgress === 0 ? '未学习' : '已学' + courseProgress + '%';
        this.setData({
          chapters,
          filteredChapters: chapters,
          course: { ...this.data.course, progress: courseProgress, progressText: courseProgressText }
        });
      },
      onFavoriteChange: (data) => {
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
    if (this.data.courseId) this.loadCourseData();
  },

  onRefresh() {
    this.setData({ refresherTriggered: true });
    if (this.data.courseId) {
      this.loadCourseDataAsync().then(() => this.setData({ refresherTriggered: false }));
    } else {
      this.setData({ refresherTriggered: false });
    }
  },

  onUnload() {
    app.unregisterMiniPlayer(this.audioCallback);
  },

  calculateListMinHeight() {
    const query = wx.createSelectorQuery();
    query.select('.course-info-section').boundingClientRect();
    query.select('.filter-bar').boundingClientRect();
    query.exec((res) => {
      const { windowHeight } = wx.getWindowInfo();
      const courseInfoHeight = res[0]?.height || 120;
      const filterBarHeight = res[1]?.height || 30;
      this.setData({ listMinHeight: windowHeight - courseInfoHeight - filterBarHeight });
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
    const t = this.data.coverLoadTime;

    const m1 = url.match(/seed\/(\d+)_cover_(.+\/\d+\/\d+)$/);
    if (m1 && m1[1] != t) return url.replace(/seed\/\d+_cover_/, `seed/${t}_cover_`);
    if (m1) return url;

    const m2 = url.match(/seed\/([^\/]+)\/(\d+\/\d+)$/);
    if (m2) return `https://picsum.photos/seed/${t}_cover_${m2[1]}/${m2[2]}`;

    const m3 = url.match(/picsum\.photos\/(\d+\/\d+)/);
    if (m3) {
      const r = url.match(/random=(\d+)/)?.[1] || '0';
      return `https://picsum.photos/seed/${t}_cover_${r}/${m3[1]}`;
    }

    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  formatChapter(chapter) {
    const lastPlayTime = Number(chapter.lastPlayTime) || 0;
    const duration = Number(chapter.duration) || 0;
    const finished = chapter.finished === true;

    let progress = 0;
    if (finished) progress = 100;
    else if (lastPlayTime > 0 && duration > 0) progress = Math.min(Math.round((lastPlayTime / duration) * 100), 100);

    let progressText = '未学习';
    if (progress === 100) progressText = '已学完';
    else if (progress > 0) progressText = '已学' + progress + '%';

    const playingChapterId = app.globalData.playingChapter?._id || '';

    return {
      ...chapter,
      progress,
      progressText,
      durationText: this.formatDuration(duration),
      isPlaying: playingChapterId === chapter._id,
      isFavorite: chapter.isFavorite || false
    };
  },

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  handleContinuePlay() {
    const { filteredChapters } = this.data;
    if (filteredChapters.length === 0) {
      wx.showToast({ title: '暂无章节', icon: 'none' });
      return;
    }

    const unfinished = filteredChapters.filter(ch => ch.progress < 100);
    if (unfinished.length > 0) {
      const target = unfinished.reduce((max, ch) => ch.progress > max.progress ? ch : max, unfinished[0]);
      this.playChapter(target._id);
    } else {
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
    if (this.data.showUnfinishedOnly) chapters = chapters.filter(ch => ch.progress < 100);
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
      const miniPlayer = this.selectComponent('#miniPlayer');
      if (miniPlayer) miniPlayer.togglePlayPause();
    } else {
      this.playChapter(id);
    }
  },

  playChapter(chapterId) {
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) {
      const currentPlaylistState = {
        courseId: this.data.courseId,
        showUnfinishedOnly: this.data.showUnfinishedOnly,
        sortOrder: this.data.sortOrder
      };
      const stateChanged =
        currentPlaylistState.courseId !== this.data.playlistState.courseId ||
        currentPlaylistState.showUnfinishedOnly !== this.data.playlistState.showUnfinishedOnly ||
        currentPlaylistState.sortOrder !== this.data.playlistState.sortOrder;
      if (stateChanged) this.setData({ playlistState: currentPlaylistState });
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
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'toggleFavorite',
        chapterId,
        courseId: this.data.courseId,
        userId: app.globalData.userId
      }
    }).then(res => {
      if (res.result.success) {
        const newIsFavorite = res.result.data.isFavorite;
        this.setData({
          chapters: this.data.chapters.map(ch =>
            ch._id === chapterId ? { ...ch, isFavorite: newIsFavorite } : ch
          )
        });
        this.applyFilterAndSort();
        wx.showToast({ title: newIsFavorite ? '已收藏' : '已取消收藏', icon: 'none' });
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('收藏操作失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  }
});