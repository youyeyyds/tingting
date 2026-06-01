// favorite/index.js
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    favoriteChapters: [],
    headlines: [],
    loadTime: 0,
    coverLoadTime: 0,
    bannerSpeed: 5000,
    loading: true,
    activeTab: 1,
    headerHeight: 0,
    scrollHeight: 0
  },

  onLoad() {
    const loadTime = app.globalData.bannerLoadTime;
    const coverLoadTime = app.globalData.coverLoadTime;
    this.setData({
      headerHeight: app.globalData.headerHeight,
      scrollHeight: app.globalData.scrollHeightWithTab
    });

    let cachedHeadlines = app.globalData.favoriteHeadlines || [];
    let cachedFavorites = app.globalData.favoriteChapters || [];

    if (cachedHeadlines.length > 0) {
      cachedHeadlines = cachedHeadlines.map(h => ({ ...h, image: this._fixImageUrl(h.image, 'banner', loadTime) }));
    }
    if (cachedFavorites.length > 0) {
      cachedFavorites = cachedFavorites.map(ch => ({ ...ch, courseCover: this._fixImageUrl(ch.courseCover, 'cover', coverLoadTime) }));
    }

    this.setData({ loadTime, coverLoadTime, headlines: cachedHeadlines, favoriteChapters: cachedFavorites, loading: true });
    this.checkLoginStatus();

    if (cachedHeadlines.length === 0) this.loadHeadlines();
    if (this.data.isLoggedIn) this.loadFavorites();

    this.audioCallback = {
      onChapterChange: ({ chapterId }) => {
        const currentPlayingId = app.globalData.playingChapter?._id;
        const favoriteChapters = this.data.favoriteChapters.map(ch => ({ ...ch, isPlaying: ch._id === currentPlayingId }));
        this.setData({ favoriteChapters });
        app.globalData.favoriteChapters = favoriteChapters;
      },
      onProgressUpdate: ({ chapterId, lastPlayTime, finished }) => {
        const favoriteChapters = this.data.favoriteChapters.map(ch => {
          if (ch._id !== chapterId) return ch;
          if (ch.finished && finished !== true) return { ...ch, lastPlayTime };
          const duration = Number(ch.duration) || 0;
          let progress = 0;
          if (finished === true) progress = 100;
          else if (lastPlayTime > 0 && duration > 0) progress = Math.min(Math.round((lastPlayTime / duration) * 100), 100);
          const progressText = progress === 100 ? '已学完' : progress > 0 ? `已学${progress}%` : '未学习';
          return { ...ch, lastPlayTime, finished: finished === true, progress, progressText };
        });
        this.setData({ favoriteChapters });
        app.globalData.favoriteChapters = favoriteChapters;
      },
      onClose: () => {
        const favoriteChapters = this.data.favoriteChapters.map(ch => ({ ...ch, isPlaying: false }));
        this.setData({ favoriteChapters });
        app.globalData.favoriteChapters = favoriteChapters;
      },
      onStop: () => {
        // iOS 切 src 时也会触发 onStop，此时 playingStatus 仍为 true（app.playAudio 在改 src 前置 true），
        // 且 playingChapter 已切到新章节。这里用 playingStatus 区分"真停止"和"切歌中转"
        const playingChapterId = app.globalData.playingChapter?._id;
        if (app.globalData.playingStatus && playingChapterId) {
          const favoriteChapters = this.data.favoriteChapters.map(ch => ({ ...ch, isPlaying: ch._id === playingChapterId }));
          this.setData({ favoriteChapters });
          app.globalData.favoriteChapters = favoriteChapters;
        } else {
          const favoriteChapters = this.data.favoriteChapters.map(ch => ({ ...ch, isPlaying: false }));
          this.setData({ favoriteChapters });
          app.globalData.favoriteChapters = favoriteChapters;
        }
      },
      onCoverRefresh: ({ coverLoadTime }) => {
        if (!coverLoadTime) return;
        const favoriteChapters = this.data.favoriteChapters.map(ch => ({
          ...ch, courseCover: app.processImageUrl(ch.courseCover, 'cover', coverLoadTime)
        }));
        this.setData({ favoriteChapters });
        app.globalData.favoriteChapters = favoriteChapters;
      }
    };
    app.registerMiniPlayer(this.audioCallback);
  },

  onUnload() {
    app.unregisterMiniPlayer(this.audioCallback);
  },

  onShow() {
    this.checkLoginStatus();
    if (this.data.isLoggedIn && app.globalData.userId) this.loadFavorites();
    this.syncImageTimes();
  },

  syncImageTimes() {
    const bt = app.globalData.bannerLoadTime;
    const ct = app.globalData.coverLoadTime;
    if (bt !== this.data.loadTime) {
      const headlines = this.data.headlines.map(h => ({ ...h, image: this._fixImageUrl(h.image, 'banner', bt) }));
      this.setData({ loadTime: bt, headlines });
      app.globalData.favoriteHeadlines = headlines;
    }
    if (ct !== this.data.coverLoadTime) {
      const favoriteChapters = this.data.favoriteChapters.map(ch => ({
        ...ch, courseCover: app.processImageUrl(ch.courseCover, 'cover', ct)
      }));
      this.setData({ coverLoadTime: ct, favoriteChapters });
      app.globalData.favoriteChapters = favoriteChapters;
    }
  },

  loadHeadlines() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'favorite' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({ ...h, image: this._fixImageUrl(h.image, 'banner') }));
        app.globalData.favoriteHeadlines = headlines;
        this.setData({ headlines, bannerSpeed: (res.result.speed || 5) * 1000 });
      }
    }).catch(err => console.error('获取头条失败', err));
  },

  _fixImageUrl(url, type = 'banner', loadTime) {
    if (!url) return url;
    if (url.match(/picsum\.photos\/seed\/fixed_/)) return url;

    const t = loadTime || (type === 'banner' ? this.data.loadTime : this.data.coverLoadTime);

    if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_(banner|cover)_/)) {
      const seedMatch = url.match(/picsum\.photos\/seed\/(\d+)_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const oldTime = seedMatch[1];
        const urlType = seedMatch[2];
        const originalSeed = seedMatch[3];
        const size = seedMatch[4];
        if (urlType === type && oldTime != t) {
          return `https://picsum.photos/seed/${t}_${type}_${originalSeed}/${size}`;
        }
      }
      return url;
    }

    if (url.includes('picsum.photos')) {
      const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        return `https://picsum.photos/seed/${t}_${type}_${seedMatch[1]}/${seedMatch[2]}`;
      }
      const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
      const randomMatch = url.match(/random=(\d+)/);
      if (sizeMatch) {
        const size = sizeMatch[1];
        const random = randomMatch ? randomMatch[1] : '0';
        return `https://picsum.photos/seed/${t}_${type}_${random}/${size}`;
      }
    }
    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  checkLoginStatus() {
    const { isLoggedIn, userId } = app.globalData;
    this.setData({ isLoggedIn: isLoggedIn || false });
    if (!isLoggedIn && userId) {
      const storedUserId = wx.getStorageSync('userId');
      if (storedUserId) {
        app.globalData.isLoggedIn = true;
        app.globalData.userId = storedUserId;
        this.setData({ isLoggedIn: true });
      }
    }
  },

  async loadFavorites() {
    if (!app.globalData.userId) {
      this.setData({ favoriteChapters: [], loading: false });
      app.globalData.favoriteChapters = [];
      return;
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'userFunctions',
        data: { type: 'getUserStats', userId: app.globalData.userId }
      });
      if (res.result.success) {
        const favorites = res.result.data.favoriteChapters || [];
        const formattedFavorites = favorites.map(ch => this.formatChapter(ch));
        formattedFavorites.sort((a, b) => (b.favoriteTime || 0) - (a.favoriteTime || 0));
        this.setData({ favoriteChapters: formattedFavorites, loading: false });
        app.globalData.favoriteChapters = formattedFavorites;
      }
    } catch (err) {
      console.error('获取收藏失败', err);
      this.setData({ loading: false });
    }
  },

  formatChapter(chapter) {
    const duration = Number(chapter.duration) || 0;
    const userProgress = chapter.userProgress || {};
    const lastPlayTime = Number(userProgress.lastPlayTime) || 0;
    const finished = userProgress.finished === true;
    const favoriteTime = userProgress.favoriteTime || 0;

    let progress = 0;
    if (finished) progress = 100;
    else if (lastPlayTime > 0 && duration > 0) progress = Math.min(Math.round((lastPlayTime / duration) * 100), 100);

    const progressText = progress === 100 ? '已学完' : progress > 0 ? `已学${progress}%` : '未学习';

    return {
      ...chapter,
      courseCover: app.processImageUrl(chapter.courseCover, 'cover', this.data.coverLoadTime),
      lastPlayTime,
      finished,
      progress,
      progressText,
      durationText: this.formatDuration(duration),
      favoriteTime
    };
  },

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  onCourseTap(e) {
    const courseId = e.currentTarget.dataset.id;
    if (courseId) wx.navigateTo({ url: `/pages/chapter/index?id=${courseId}` });
  },

  onChapterTap(e) {
    const index = e.currentTarget.dataset.index;
    const chapter = this.data.favoriteChapters[index];
    if (chapter.isPlaying) {
      const miniPlayer = this.selectComponent('#miniPlayer');
      if (miniPlayer) miniPlayer.togglePlayPause();
    } else {
      this.playFavoriteList(index);
    }
  },

  playFavoriteList(startIndex) {
    const favoriteChapters = this.data.favoriteChapters;
    if (favoriteChapters.length === 0) return;

    const playlistData = favoriteChapters.map(ch => ({
      _id: ch._id, title: ch.title, duration: ch.duration,
      durationText: ch.durationText || this.formatDuration(ch.duration),
      audioUrl: ch.audioUrl, seq: ch.seq, course: ch.course,
      courseTitle: ch.courseTitle, courseCover: ch.courseCover, author: ch.author,
      lastPlayTime: ch.lastPlayTime || 0, finished: ch.finished || false,
      progress: ch.progress || 0, progressText: ch.progressText || '未学习'
    }));

    const startChapterId = favoriteChapters[startIndex]._id;
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer) {
      miniPlayer.play(startChapterId, playlistData, null, 'asc');
    }
    this.setData({ favoriteChapters: favoriteChapters.map(ch => ({ ...ch, isPlaying: ch._id === startChapterId })) });
  },

  async onRemoveTap(e) {
    const chapterId = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    try {
      const res = await wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'toggleFavorite', chapterId, userId: app.globalData.userId }
      });
      if (res.result.success) {
        const favoriteChapters = this.data.favoriteChapters;
        favoriteChapters.splice(index, 1);
        this.setData({ favoriteChapters });
        app.globalData.favoriteChapters = favoriteChapters;
        wx.showToast({ title: '已取消收藏', icon: 'success' });
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    } catch (err) {
      console.error('取消收藏失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onTabChange(e) {
    app.switchTab(e.currentTarget.dataset.index);
  }
});