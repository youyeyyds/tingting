// mini-player/index.js
const app = getApp();

Component({
  properties: {
    initialChapters: { type: Array, value: [] },
    initialCourse: { type: Object, value: {} }
  },

  data: {
    visible: false,
    fadeInClass: '',
    playerBottom: 15,
    currentChapter: {},
    currentIndex: 0,
    courseCover: '',
    courseName: '',
    course: {},
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progressPercent: 0,
    playbackRate: 2,
    chapters: [],
    playlistSortOrder: 'asc',
    isFavoriteList: false
  },

  lifetimes: {
    created() {
      this.bgAudioManager = app.bgAudioManager;
      this.speedOptions = [0.75, 1, 1.25, 1.5, 2];
      this.audioCallback = {
        onChapterChange: ({ chapterId }) => {
          // 当外部（player页面）改变播放章节时，同步更新mini-player的currentChapter
          if (chapterId) {
            const chapter = this.data.chapters.find(ch => ch._id === chapterId);
            const index = this.data.chapters.findIndex(ch => ch._id === chapterId);
            if (chapter && index >= 0) {
              this.setData({ currentChapter: chapter, currentIndex: index });
            }
          }
        },
        onPlay: () => {
          this.setData({ isPlaying: true });
          // 通知章节变化，更新 chapter 页面的高亮样式
          const { currentChapter } = this.data;
          if (currentChapter) {
            app.notifyCallbacks('onChapterChange', { chapterId: currentChapter._id });
          }
        },
        onPause: () => {
          this.setData({ isPlaying: false });
          // 通知播放暂停状态变化
          const { currentChapter } = this.data;
          if (currentChapter) {
            app.notifyCallbacks('onPlayPause', { chapterId: currentChapter._id, isPlaying: false });
          }
        },
        onEnded: () => this.onAudioEnded(),
        onError: () => {
          this.setData({ isPlaying: false });
        },
        onStop: () => {
          this.setData({ isPlaying: false });
        },
        onPlayFromList: (data) => this.playFromList(data),
        onClose: () => {
          // 关闭通知已由 methods.onClose() 处理，这里只记录状态变化
        },
        onCoverRefresh: (data) => {
          if (data.coverLoadTime) {
            // 无论播放器是否显示，都记录新时间戳，下次显示时会同步
            const newCover = this.rebuildImageUrl(this.data.courseCover, data.coverLoadTime);
            this.setData({
              courseCover: newCover,
              coverLoadTime: data.coverLoadTime,
              course: { ...this.data.course, cover: newCover }
            });
            // 如果播放器正在显示，立即更新
            if (this.data.visible) {
              this.setData({ courseCover: newCover });
            }
          }
        }
      };
    },
    attached() {
      // 直接监听 bgAudioManager.onTimeUpdate，不依赖 notifyCallbacks
      this._onTimeUpdate = () => {
        const currentTime = this.bgAudioManager.currentTime || 0;
        const duration = this.bgAudioManager.duration || 0;
        const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
        this.setData({ currentTime, duration, progressPercent });
      };
      this.bgAudioManager.onTimeUpdate(this._onTimeUpdate);
      // 保留其他事件的回调
      app.registerMiniPlayer(this.audioCallback);
    },
    detached() {
      // 注销直接监听
      if (this._onTimeUpdate && this.bgAudioManager.offTimeUpdate) {
        this.bgAudioManager.offTimeUpdate(this._onTimeUpdate);
      }
      app.unregisterMiniPlayer(this.audioCallback);
    }
  },

  pageLifetimes: {
    show() {
      const pages = getCurrentPages();
      this.currentPageRoute = pages[pages.length - 1]?.route || '';
      const isTabBarPage = ['pages/index/index', 'pages/favorite/index', 'pages/mine/index'].includes(this.currentPageRoute);

      if (!app.globalData.miniPlayerActive) {
        this.setData({ visible: false, fadeInClass: '' });
        return;
      }

      this.showMiniPlayer(isTabBarPage);
    },
  },

  methods: {
    showMiniPlayer(isTabBarPage) {
      if (!app.globalData.miniPlayerActive) {
        this.setData({ visible: false, fadeInClass: '' });
        return;
      }

      const { playingCourse, playingChapter, playingSeq, playlistChaptersData, playlistSortOrder, isFavoriteList } = app.globalData;
      let playbackRate = this.bgAudioManager.playbackRate || 2;
      if (!this.speedOptions.includes(playbackRate)) {
        playbackRate = 2;
      }

      let courseCover = this.data.courseCover;

      // 通过 playingSeq 找到 currentChapter 和 index
      const chapters = playlistChaptersData || [];
      const currentChapter = playingChapter || chapters.find(ch => ch.seq === playingSeq) || {};
      const currentIndex = chapters.findIndex(ch => ch._id === currentChapter._id);

      const currentTime = this.bgAudioManager.currentTime || 0;
      const duration = this.bgAudioManager.duration || 0;
      const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

      const data = {
        playerBottom: this.calcPosition(),
        isPlaying: !this.bgAudioManager.paused,
        currentChapter: currentChapter,
        currentIndex: currentIndex >= 0 ? currentIndex : 0,
        courseCover: courseCover,
        courseName: playingCourse?.title || '',
        chapters: playlistChaptersData || [],
        course: { ...playingCourse, cover: courseCover } || {},
        playlistSortOrder: playlistSortOrder || 'asc',
        isFavoriteList: isFavoriteList || false,
        currentTime: currentTime,
        duration: duration,
        progressPercent: progressPercent,
        playbackRate: playbackRate
      };

      if (isTabBarPage && !app.globalData.miniPlayerIndexFadedIn) {
        this.setData({ visible: true, fadeInClass: 'fade-in', ...data });
        app.globalData.miniPlayerIndexFadedIn = true;
      } else {
        this.setData({ visible: true, fadeInClass: '', ...data });
      }
    },

    calcPosition() {
      const pages = getCurrentPages();
      const route = pages[pages.length - 1]?.route || '';
      const tabBarPages = ['pages/index/index', 'pages/favorite/index', 'pages/mine/index'];

      if (!tabBarPages.includes(route)) return 15;

      const windowInfo = wx.getWindowInfo();
      const tabBarHeight = 100 * (windowInfo.windowWidth / 750);
      const safeArea = windowInfo.screenHeight - (windowInfo.safeArea?.bottom || windowInfo.screenHeight);
      return 8 + tabBarHeight + safeArea;
    },

    savePlayStateCache(course, chapter, sortOrder, playMode) {
      wx.setStorageSync('playingCourse', JSON.stringify(course));
      wx.setStorageSync('playingChapter', JSON.stringify(chapter));
      wx.setStorageSync('playingSeq', chapter?.seq);
      wx.setStorageSync('playlistSortOrder', sortOrder);
      wx.setStorageSync('playMode', playMode);
    },

    clearPlayStateCache() {
      wx.removeStorageSync('playingCourse');
      wx.removeStorageSync('playingChapter');
      wx.removeStorageSync('playingSeq');
      wx.removeStorageSync('playlistSortOrder');
      wx.removeStorageSync('playMode');
    },

    updateChapterCache(chapter) {
      wx.setStorageSync('playingChapter', JSON.stringify(chapter));
      wx.setStorageSync('playingSeq', chapter?.seq);
    },

    playFromList(data) {
      const { index, chapters } = data;
      if (!chapters || chapters.length === 0 || index < 0) return;

      const chapter = chapters[index];
      if (!chapter?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      if (!app.globalData.coverLoadTime) {
        app.globalData.coverLoadTime = Date.now();
      }
      const coverLoadTime = app.globalData.coverLoadTime;

      const courseCover = this.fixImageUrl(chapter.courseCover || '', coverLoadTime);

      const course = {
        _id: chapter.course,
        title: chapter.courseTitle || '收藏列表',
        cover: courseCover,
        author: chapter.author || '',
        chapterCount: chapters.length
      };

      this.setData({
        chapters: chapters,
        course: course,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: courseCover,
        courseName: chapter.courseTitle || '收藏列表',
        playlistSortOrder: 'asc',
        isFavoriteList: true,
        coverLoadTime: coverLoadTime
      });

      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingSeq = chapter.seq;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = chapters;
      app.globalData.playlistSortOrder = 'asc';
      app.globalData.playMode = 'sequence';
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.isFavoriteList = true;

      this.savePlayStateCache(course, chapter, 'asc', 'sequence');

      // 计算新章节的播放进度
      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const chapterDuration = Number(chapter.duration) || 0;
      const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

      this.setData({
        visible: true,
        fadeInClass: 'fade-in',
        playerBottom: this.calcPosition(),
        isPlaying: false,
        currentTime: lastPlayTime,
        duration: chapterDuration,
        progressPercent: progressPercent
      });

      this.loadAudio(chapter);
    },

    async play(chapterId, playlistChapters, courseData, sortOrder) {
      if (this.data.currentChapter._id && this.data.isPlaying) {
        this.saveProgress();
      }

      let chapters = playlistChapters || this.properties.initialChapters;
      let course = courseData || this.properties.initialCourse;

      const index = chapters.findIndex(ch => ch._id === chapterId);

      if (index === -1 || !chapters[index]?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      const chapter = chapters[index];

      if (!app.globalData.coverLoadTime) {
        app.globalData.coverLoadTime = Date.now();
      }
      const coverLoadTime = app.globalData.coverLoadTime;

      const courseCover = this.fixImageUrl(course.cover || '', coverLoadTime);
      course.cover = courseCover;

      const currentCourseId = app.globalData.playingCourse && app.globalData.playingCourse._id;
      const isNewPlaylist = !app.globalData.miniPlayerActive || currentCourseId !== course._id;
      // 每次点击章节卡片开始播放时，都继承章节列表当前的排序
      // 排序改变后，只有再次点击章节卡片开始播放时才会继承新的排序
      const order = sortOrder || app.globalData.playlistSortOrder || 'asc';

      // filteredChapters 已经是章节列表排序后的数组，直接使用即可
      const globalChapters = chapters;

      this.setData({ chapters: chapters, course: course, playlistSortOrder: order, isFavoriteList: false, coverLoadTime: coverLoadTime });

      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingSeq = chapter.seq;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = globalChapters;
      // 每次点击章节卡片都更新排序状态
      app.globalData.playlistSortOrder = order;
      if (isNewPlaylist) {
        app.globalData.playMode = 'sequence';
      }
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.isFavoriteList = false;

      this.savePlayStateCache(course, chapter, order, 'sequence');

      // 计算新章节的播放进度
      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const chapterDuration = Number(chapter.duration) || 0;
      const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

      this.setData({
        visible: true,
        fadeInClass: 'fade-in',
        playerBottom: this.calcPosition(),
        isPlaying: false,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: courseCover,
        courseName: course.title || '',
        isFavoriteList: false,
        currentTime: lastPlayTime,
        duration: chapterDuration,
        progressPercent: progressPercent
      });

      this.loadAudio(chapter);
    },

    async loadAudio(chapter) {
      this._audioEndedProcessing = false;

      const bgAudio = this.bgAudioManager;
      const src = chapter?.audioUrl;

      if (!src) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        this.setData({ isPlaying: false });
        return;
      }

      if (src.startsWith('cloud://')) {
        try {
          wx.showLoading({ title: '加载中...', mask: true });
          const res = await wx.cloud.getTempFileURL({ fileList: [src] });
          wx.hideLoading();
          const tempUrl = res.fileList?.[0]?.tempFileURL;
          if (!tempUrl) throw new Error('获取链接失败');
          this.playWithUrl(chapter, tempUrl);
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '音频加载失败', icon: 'none' });
          this.setData({ isPlaying: false });
        }
      } else {
        this.playWithUrl(chapter, src);
      }
    },

    playWithUrl(chapter, src) {
      const bgAudio = this.bgAudioManager;
      const [baseUrl, query] = src.split('?');
      bgAudio.title = chapter.title || '音频课程';
      bgAudio.epname = this.data.course.title || '';
      bgAudio.coverImgUrl = this.data.course.cover || '';
      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const duration = Number(chapter.duration) || 0;
      const startTime = (lastPlayTime >= duration && duration > 0) ? 0 : lastPlayTime;
      bgAudio.startTime = startTime;
      bgAudio.src = query ? `${encodeURI(baseUrl)}?${query}` : encodeURI(src);
    },

    onPlayPause() {
      // 防止快速点击导致状态混乱
      if (this._playPauseLock) return;
      this._playPauseLock = true;
      setTimeout(() => { this._playPauseLock = false; }, 300);

      const { currentChapter, isPlaying } = this.data;
      if (isPlaying) {
        this.bgAudioManager.pause();
        this.saveProgress();
        this.setData({ isPlaying: false });
        app.notifyCallbacks('onPlayPause', { chapterId: currentChapter._id, isPlaying: false });
      } else {
        this.bgAudioManager.play();
        this.setData({ isPlaying: true });
        app.notifyCallbacks('onPlayPause', { chapterId: currentChapter._id, isPlaying: true });
      }
    },

    togglePlayPause() {
      this.onPlayPause();
    },

    onSpeedChange() {
      const { playbackRate } = this.data;
      // 只有1x和2x，切换逻辑：<2时直接切到2，=2时切到1
      const nextRate = playbackRate >= 2 ? 1 : 2;
      this.setData({ playbackRate: nextRate });
      this.bgAudioManager.playbackRate = nextRate;
    },

    onAudioEnded() {
      if (this._audioEndedProcessing) return;
      this._audioEndedProcessing = true;

      this.updateProgress(0, true);
      const { chapters, currentIndex, playlistSortOrder } = this.data;
      const playMode = app.globalData.playMode || 'sequence';
      const isDesc = playlistSortOrder === 'desc';

      if (playMode === 'single') {
        const currentChapter = chapters[currentIndex];
        if (currentChapter?.audioUrl) {
          currentChapter.lastPlayTime = 0;
          // 单曲循环时重置进度
          this.setData({
            currentChapter,
            currentTime: 0,
            duration: Number(currentChapter.duration) || 0,
            progressPercent: 0
          });
          this.loadAudio(currentChapter);
        } else {
          this.setData({ isPlaying: false });
        }
        this._audioEndedProcessing = false;
        return;
      }

      // 计算下一曲的索引：正序+1，倒序-1
      let nextIndex = isDesc ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= chapters.length) {
        if (playMode === 'loop') {
          // 循环模式：正序回到第一首，倒序回到最后一首
          const targetIndex = isDesc ? chapters.length - 1 : 0;
          const targetChapter = chapters[targetIndex];
          if (targetChapter?.audioUrl) {
            app.globalData.playingChapter = targetChapter;
            app.globalData.playingSeq = targetChapter.seq;
            app.globalData.playingIndex = targetIndex;
            this.updateChapterCache(targetChapter);

            const lastPlayTime = Number(targetChapter.lastPlayTime) || 0;
            const chapterDuration = Number(targetChapter.duration) || 0;
            const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

            this.setData({
              currentChapter: targetChapter,
              currentIndex: targetIndex,
              currentTime: lastPlayTime,
              duration: chapterDuration,
              progressPercent: progressPercent
            });
            this.loadAudio(targetChapter);
            app.notifyCallbacks('onChapterChange', { chapterId: targetChapter._id });
          }
        } else {
          this.setData({ isPlaying: false });
        }
        this._audioEndedProcessing = false;
        return;
      }

      if (chapters[nextIndex]?.audioUrl) {
        const nextChapter = chapters[nextIndex];
        app.globalData.playingChapter = nextChapter;
        app.globalData.playingSeq = nextChapter.seq;
        app.globalData.playingIndex = nextIndex;
        this.updateChapterCache(nextChapter);

        const lastPlayTime = Number(nextChapter.lastPlayTime) || 0;
        const chapterDuration = Number(nextChapter.duration) || 0;
        const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

        this.setData({
          currentChapter: nextChapter,
          currentIndex: nextIndex,
          currentTime: lastPlayTime,
          duration: chapterDuration,
          progressPercent: progressPercent
        });
        this.loadAudio(nextChapter);
        app.notifyCallbacks('onChapterChange', { chapterId: nextChapter._id });
      } else {
        this.setData({ isPlaying: false });
      }
      this._audioEndedProcessing = false;
    },

    onClose() {
      // 保存当前章节ID用于回调
      const lastChapterId = this.data.currentChapter?._id || app.globalData.playingChapter?._id;
      // 立即重置状态
      this.setData({
        visible: false,
        fadeInClass: '',
        chapters: [],
        currentChapter: {},
        currentIndex: 0,
        course: {},
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        progressPercent: 0
      });
      this.saveProgress();
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingSeq = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = [];
      app.globalData.isFavoriteList = false;
      this.clearPlayStateCache();
      app.notifyCallbacks('onClose', { chapterId: lastChapterId });
    },

    saveProgress() {
      const currentTime = this.bgAudioManager.currentTime || this.data.currentTime;
      this.updateProgress(Math.floor(currentTime));
    },

    updateProgress(time, finished) {
      const chapterId = this.data.currentChapter._id;
      const courseId = this.data.currentChapter.course || this.data.course._id;
      const userId = app.globalData.userId;

      if (!userId || !chapterId || !courseId) return;

      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'updateChapterProgress',
          chapterId: chapterId,
          courseId: courseId,
          lastPlayTime: time,
          finished: finished,
          userId: userId
        }
      }).then(res => {
        if (res.result.success) {
          const chapters = this.data.chapters.map(ch => {
            if (ch._id === chapterId) {
              if (finished === true) {
                return { ...ch, lastPlayTime: time, finished: true, progress: 100, progressText: '已学完' };
              }
              if (ch.finished) {
                return { ...ch, lastPlayTime: time };
              }
              const chDuration = Number(ch.duration) || 0;
              const progress = chDuration > 0 ? Math.min(Math.round((time / chDuration) * 100), 100) : 0;
              let progressText = '未学习';
              if (progress === 100) progressText = '已学完';
              else if (progress > 0) progressText = '已学' + progress + '%';
              return { ...ch, lastPlayTime: time, progress, progressText };
            }
            return ch;
          });
          this.setData({ chapters });
          app.globalData.playlistChaptersData = chapters;
          app.notifyCallbacks('onProgressUpdate', {
            chapterId: chapterId,
            lastPlayTime: time,
            duration: this.data.duration,
            finished: finished
          });
        }
      }).catch(err => console.error('更新进度失败:', err));
    },

    fixImageUrl(url, coverLoadTime) {
      if (!url) return url;

      if (url.match(/picsum\.photos\/seed\/fixed_/)) return url;
      if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_cover_/)) return url;

      const loadTime = coverLoadTime || app.globalData.coverLoadTime || Date.now();

      if (url.includes('picsum.photos')) {
        const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
        if (seedMatch) {
          const originalSeed = seedMatch[1];
          const size = seedMatch[2];
          const newSeed = `${loadTime}_cover_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }

        const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
        const randomMatch = url.match(/random=(\d+)/);

        if (sizeMatch) {
          const size = sizeMatch[1];
          const originalRandom = randomMatch ? randomMatch[1] : '0';
          const seed = `${loadTime}_cover_${originalRandom}`;
          return `https://picsum.photos/seed/${seed}/${size}`;
        }
      }

      return url;
    },

    rebuildImageUrl(url, newLoadTime) {
      if (!url) return url;

      if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_cover_/)) {
        const seedMatch = url.match(/picsum\.photos\/seed\/(\d+)_cover_([^\/]+)\/(\d+(\/\d+)?)/);
        if (seedMatch) {
          const originalSeed = seedMatch[2];
          const size = seedMatch[3];
          const newSeed = `${newLoadTime}_cover_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }
      }

      return this.fixImageUrl(url, newLoadTime);
    },

    preventMove() {},

    // 封面图片加载失败时使用默认封面
    onCoverError() {
      // 优先使用本地缓存的默认封面，其次使用云端配置的，最后使用耳机图标
      const localCover = app.globalData.defaultCoverLocalPath;
      const cloudCover = app.globalData.defaultCoverUrl;
      const defaultCover = localCover || cloudCover || '/icons/svg/headphones.svg';
      if (this.data.courseCover !== defaultCover) {
        this.setData({ courseCover: defaultCover });
      }
    },

    openPlayerPanel() {
      wx.navigateTo({
        url: '/pages/player/index'
      });
    },

    onPlaylistTap() {
      const playlistPanel = this.selectComponent('#playlistPanel');
      if (playlistPanel) playlistPanel.show();
    },

    onPlaylistCollapse() {},

    onPlaylistClear() {
      const lastChapterId = this.data.currentChapter?._id;
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingSeq = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = [];
      app.globalData.isFavoriteList = false;
      this.clearPlayStateCache();
      this.setData({ visible: false, isPlaying: false, chapters: [], isFavoriteList: false });
      app.notifyCallbacks('onStop', { chapterId: lastChapterId });
    },

    onPlaylistSyncSort(e) {
      const sortedChapters = e.detail.chapters;
      const currentId = this.data.currentChapter._id;
      const newIndex = sortedChapters.findIndex(ch => ch._id === currentId);
      const currentChapter = sortedChapters[newIndex];
      this.setData({ chapters: sortedChapters, currentIndex: newIndex });
      app.globalData.playingIndex = newIndex;
      app.globalData.playingSeq = currentChapter?.seq;
    },

    onPlaylistPlay(e) {
      const { chapterId, index } = e.detail;
      const chapter = this.data.chapters.find(ch => ch._id === chapterId);

      if (chapterId === this.data.currentChapter._id) {
        if (this.data.isPlaying) {
          this.bgAudioManager.pause();
          this.saveProgress();
          app.notifyCallbacks('onPlayPause', { chapterId, isPlaying: false });
        } else {
          this.bgAudioManager.play();
          app.notifyCallbacks('onPlayPause', { chapterId, isPlaying: true });
        }
        return;
      }

      if (this.data.currentChapter._id && this.data.isPlaying) {
        this.saveProgress();
      }

      if (chapter?.audioUrl) {
        app.globalData.playingChapter = chapter;
        app.globalData.playingSeq = chapter.seq;
        app.globalData.playingIndex = index;
        this.updateChapterCache(chapter);

        // 计算新章节的播放进度
        const lastPlayTime = Number(chapter.lastPlayTime) || 0;
        const chapterDuration = Number(chapter.duration) || 0;
        const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

        this.setData({
          currentChapter: chapter,
          currentIndex: index,
          isPlaying: false,
          currentTime: lastPlayTime,
          duration: chapterDuration,
          progressPercent: progressPercent
        });
        this.loadAudio(chapter);
        app.notifyCallbacks('onChapterChange', { chapterId: chapter._id });
      }
    },

    onPlaylistDelete(e) {
      const { chapterId } = e.detail;
      const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
      this.setData({ chapters });
      app.globalData.playlistChaptersData = chapters;

      if (chapterId === this.data.currentChapter._id) {
        if (this.data.isPlaying) {
          this.saveProgress();
        }

        const nextIndex = this.data.currentIndex;
        if (nextIndex < chapters.length && chapters[nextIndex]?.audioUrl) {
          const nextChapter = chapters[nextIndex];
          app.globalData.playingChapter = nextChapter;
          app.globalData.playingSeq = nextChapter.seq;
          app.globalData.playingIndex = nextIndex;
          this.updateChapterCache(nextChapter);

          // 计算新章节的播放进度
          const lastPlayTime = Number(nextChapter.lastPlayTime) || 0;
          const chapterDuration = Number(nextChapter.duration) || 0;
          const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

          this.setData({
            currentChapter: nextChapter,
            currentIndex: nextIndex,
            currentTime: lastPlayTime,
            duration: chapterDuration,
            progressPercent: progressPercent
          });
          this.loadAudio(nextChapter);
          app.notifyCallbacks('onChapterChange', { chapterId: nextChapter._id });
        } else {
          const lastChapterId = this.data.currentChapter?._id;
          this.bgAudioManager.stop();
          app.globalData.miniPlayerActive = false;
          app.globalData.playlistChaptersData = [];
          this.clearPlayStateCache();
          this.setData({ visible: false, isPlaying: false });
          app.notifyCallbacks('onStop', { chapterId: lastChapterId });
        }
      }
    }
  }
});
