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
    speedOptions: [0.75, 1, 1.25, 1.5, 2],
    chapters: [], // 播放列表
    playlistSortOrder: 'asc', // 播放列表排序
    isFavoriteList: false, // 是否是收藏列表
    showPlayerPanel: false, // 播放器面板显示状态
    currentTimeText: '0:00',
    remainingTimeText: '-0:00',
    showTotalTime: false, // 显示总时长还是剩余时长
    playMode: 'sequence', // sequence, loop, single
    isFavorite: false,
    speedIndicatorPos: 70, // 倍速指示器位置百分比（默认2倍速对应70%）
    coverRotationAngle: 0, // 封面旋转角度
    nextChapterSeq: '', // 下一条章节序号
    nextChapterTitle: '' // 下一条章节标题
  },

  lifetimes: {
    created() {
      this.bgAudioManager = app.bgAudioManager;
      this.audioCallback = {
        onCanplay: (data) => {
          if (this.data.visible) {
            this.setData({ duration: data.duration });
            this.updateProgressDisplay();
          }
        },
        onPlay: () => {
          if (this.data.visible) {
            this.setData({ isPlaying: true });
            this.startCoverRotation();
          }
        },
        onPause: () => {
          if (this.data.visible) {
            this.setData({ isPlaying: false });
            this.stopCoverRotation();
          }
        },
        onTimeUpdate: (data) => {
          if (this.data.visible) {
            const currentTime = data.currentTime;
            const duration = this.bgAudioManager.duration || this.data.duration;
            const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
            this.setData({
              currentTime: currentTime,
              progressPercent: progressPercent
            });
            if (this.data.showPlayerPanel) {
              this.updateProgressDisplay();
            }
          }
        },
        onEnded: () => this.onAudioEnded(),
        onError: () => {
          if (this.data.visible) {
            this.setData({ isPlaying: false });
            this.stopCoverRotation();
          }
        },
        onStop: () => {
          if (this.data.visible) {
            this.setData({ isPlaying: false });
            this.stopCoverRotation();
          }
        },
        onPlayFromList: (data) => this.playFromList(data),
        onClose: () => {
            this.stopCoverRotation();
            const pages = getCurrentPages();
            const isForeground = this.currentPageRoute === pages[pages.length - 1]?.route;
            // 先播放淡出动画，动画结束后再清除数据
            this.setData({ fadeInClass: 'fade-out' });
            setTimeout(() => {
              this.setData({
                visible: false,
                fadeInClass: '',
                showPlayerPanel: false,
                chapters: [],
                currentChapter: {},
                currentIndex: 0,
                course: {},
                isPlaying: false,
                currentTime: 0,
                duration: 0,
                progressPercent: 0,
                coverRotationAngle: 0
              });
            }, 300);
          },
        onCoverRefresh: (data) => {
          // 首页刷新时通知更新封面
          if (this.data.visible && data.coverLoadTime) {
            const courseCover = this.rebuildImageUrl(this.data.courseCover, data.coverLoadTime);
            this.setData({
              courseCover: courseCover,
              coverLoadTime: data.coverLoadTime,
              course: { ...this.data.course, cover: courseCover }
            });
          }
        }
      };
    },
    attached() {
      app.registerMiniPlayer(this.audioCallback);
    },
    detached() {
      app.unregisterMiniPlayer(this.audioCallback);
    }
  },

  pageLifetimes: {
    show() {
      const pages = getCurrentPages();
      this.currentPageRoute = pages[pages.length - 1]?.route || '';
      const isTabBarPage = ['pages/index/index', 'pages/favorite/index', 'pages/mine/index'].includes(this.currentPageRoute);

      if (!app.globalData.miniPlayerActive) {
        this.setData({ visible: false, fadeInClass: '', showPlayerPanel: false });
        return;
      }

      // 获取封面时间戳
      if (!app.globalData.coverLoadTime) {
        app.globalData.coverLoadTime = Date.now();
      }
      const globalCoverTime = app.globalData.coverLoadTime;

      const { playingCourse, playingChapter, playingIndex, playlistChaptersData, playlistSortOrder, playMode, isFavoriteList } = app.globalData;
      // 从 bgAudioManager 获取倍速，如果还没设置则使用默认值2
      let playbackRate = this.bgAudioManager.playbackRate || 2;
      // 如果倍速不在支持范围内，使用默认值2
      const supportedRates = [0.75, 1, 1.25, 1.5, 2];
      if (!supportedRates.includes(playbackRate)) {
        playbackRate = 2;
      }

      // 检查封面时间戳是否变化，变化则重新构建URL
      let courseCover = this.data.courseCover;
      if (globalCoverTime !== this.data.coverLoadTime) {
        courseCover = this.rebuildImageUrl(playingCourse?.cover || '', globalCoverTime);
      }

      const data = {
        playerBottom: this.calcPosition(),
        isPlaying: !this.bgAudioManager.paused,
        currentChapter: playingChapter || {},
        currentIndex: playingIndex || 0,
        courseCover: courseCover,
        courseName: playingCourse?.title || '',
        chapters: playlistChaptersData || [],
        course: { ...playingCourse, cover: courseCover } || {},
        playlistSortOrder: playlistSortOrder || 'asc',
        playMode: playMode || 'sequence',
        isFavoriteList: isFavoriteList || false,
        currentTime: this.bgAudioManager.currentTime || 0,
        duration: this.bgAudioManager.duration || 0,
        playbackRate: playbackRate,
        coverLoadTime: globalCoverTime
      };

      // 首页/收藏页/我的页：如果还没淡入过，则淡入
      if (isTabBarPage && !app.globalData.miniPlayerIndexFadedIn) {
        this.fadeIn(data);
        app.globalData.miniPlayerIndexFadedIn = true;
      } else {
        // 其他情况直接显示（无动画）
        this.setData({ visible: true, fadeInClass: '', ...data });
      }
      // 更新倍速指示器位置
      this.updateSpeedIndicator();
      // 如果正在播放，启动封面旋转
      if (data.isPlaying) {
        this.startCoverRotation();
      }
    }
  },

  methods: {
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

    fadeIn(data) {
      this.setData({ visible: true, fadeInClass: 'fade-in', ...data });
      this.updateNextChapterInfo();
    },

    // 从收藏列表播放
    playFromList(data) {
      const { index, chapters } = data;
      if (!chapters || chapters.length === 0 || index < 0) return;

      const chapter = chapters[index];
      if (!chapter?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      // 获取封面时间戳
      if (!app.globalData.coverLoadTime) {
        app.globalData.coverLoadTime = Date.now();
      }
      const coverLoadTime = app.globalData.coverLoadTime;

      // 处理封面图片
      const courseCover = this.fixImageUrl(chapter.courseCover || '', coverLoadTime);

      // 构建课程信息
      const course = {
        _id: chapter.course,
        title: chapter.courseTitle || '收藏列表',
        cover: courseCover,
        author: chapter.author || '',
        chapterCount: chapters.length
      };

      // 更新数据
      this.setData({
        chapters: chapters,
        course: course,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: courseCover,
        courseName: chapter.courseTitle || '收藏列表',
        playlistSortOrder: 'asc',
        isFavoriteList: true, // 标识这是收藏列表
        coverLoadTime: coverLoadTime
      });

      // 更新全局数据
      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = chapters;
      app.globalData.playlistSortOrder = 'asc';
      app.globalData.playMode = 'sequence';
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.isFavoriteList = true; // 标识这是收藏列表

      // 淡入显示
      this.fadeIn({
        playerBottom: this.calcPosition(),
        currentChapter: chapter,
        currentIndex: index,
        courseCover: courseCover,
        courseName: chapter.courseTitle || '收藏列表',
        chapters: chapters,
        course: course,
        playlistSortOrder: 'asc',
        isFavoriteList: true
      });

      // 播放音频（使用 loadAudio 处理云存储链接）
      this.loadAudio(chapter);
    },

    async play(chapterId, playlistChapters, courseData, sortOrder) {
      // 先保存当前播放进度（如果有正在播放的章节）
      if (this.data.currentChapter._id && this.data.isPlaying) {
        this.saveProgress();
      }

      // 使用传入的播放列表，如果没有传入则使用 properties 的初始数据
      let chapters = playlistChapters || this.properties.initialChapters;
      let course = courseData || this.properties.initialCourse;

      const index = chapters.findIndex(ch => ch._id === chapterId);

      if (index === -1 || !chapters[index]?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      const chapter = chapters[index];

      // 获取封面时间戳
      if (!app.globalData.coverLoadTime) {
        app.globalData.coverLoadTime = Date.now();
      }
      const coverLoadTime = app.globalData.coverLoadTime;

      // 处理封面图片
      const courseCover = this.fixImageUrl(course.cover || '', coverLoadTime);
      course.cover = courseCover;

      // 判断是否需要更新排序状态：第一次创建播放列表或切换了课程时使用传入的排序
      const currentCourseId = app.globalData.playingCourse && app.globalData.playingCourse._id;
      const isNewPlaylist = !app.globalData.miniPlayerActive || currentCourseId !== course._id;
      const order = isNewPlaylist ? (sortOrder || 'asc') : (app.globalData.playlistSortOrder || sortOrder || 'asc');

      // 更新播放列表数据
      this.setData({ chapters: chapters, course: course, playlistSortOrder: order, isFavoriteList: false, coverLoadTime: coverLoadTime });

      // 保存到全局数据，以便其他页面恢复
      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = chapters; // 保存完整的播放列表数据
      if (isNewPlaylist) {
        app.globalData.playlistSortOrder = order; // 只在创建新播放列表时保存排序状态
        app.globalData.playMode = 'sequence'; // 新播放列表默认顺序播放
      }
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.isFavoriteList = false; // 课程播放列表

      this.fadeIn({
        playerBottom: this.calcPosition(),
        isPlaying: false,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: courseCover,
        courseName: course.title || '',
        isFavoriteList: false
      });

      this.loadAudio(chapter);
    },

    async loadAudio(chapter) {
      // 重置播放结束处理标志
      this._audioEndedProcessing = false;

      const bgAudio = this.bgAudioManager;
      const src = chapter?.audioUrl;

      // 安全检查：音频地址不存在
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
      // 从上次播放位置继续播放（完播时 lastPlayTime=0，自然从头开始）
      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const duration = Number(chapter.duration) || 0;
      // 安全防护：lastPlayTime >= duration 时从头开始
      const startTime = (lastPlayTime >= duration && duration > 0) ? 0 : lastPlayTime;
      bgAudio.startTime = startTime;
      bgAudio.src = query ? `${encodeURI(baseUrl)}?${query}` : encodeURI(baseUrl);
    },

    onPlayPause() {
      if (this.data.isPlaying) {
        this.bgAudioManager.pause();
        this.saveProgress();
      } else {
        this.bgAudioManager.play();
      }
    },

    // 公开方法：切换播放/暂停状态
    togglePlayPause() {
      this.onPlayPause();
    },

    onSpeedChange() {
      const { speedOptions, playbackRate } = this.data;
      const nextRate = speedOptions[(speedOptions.indexOf(playbackRate) + 1) % speedOptions.length];
      this.setData({ playbackRate: nextRate });
      this.bgAudioManager.playbackRate = nextRate;
    },

    onAudioEnded() {
      // 防止重复触发
      if (this._audioEndedProcessing) return;
      this._audioEndedProcessing = true;

      // 自然播放结束，设为完播，lastPlayTime=0，下次从头开始
      this.updateProgress(0, true);
      const { chapters, currentIndex } = this.data;
      const playMode = app.globalData.playMode || 'sequence';

      console.log('onAudioEnded 触发:', { playMode, currentIndex, chaptersLength: chapters.length });

      // 单章循环：从头重新播放当前章节
      if (playMode === 'single') {
        const currentChapter = chapters[currentIndex];
        if (currentChapter?.audioUrl) {
          // lastPlayTime=0，下次从头开始
          currentChapter.lastPlayTime = 0;
          this.setData({ currentChapter });
          this.loadAudio(currentChapter);
        } else {
          this.setData({ isPlaying: false });
        }
        this._audioEndedProcessing = false;
        return;
      }

      // 顺序播放或列表循环：播放下一章
      const nextIndex = currentIndex + 1;

      // 列表结束处理
      if (nextIndex >= chapters.length) {
        if (playMode === 'loop') {
          // 列表循环：从头开始
          const firstChapter = chapters[0];
          if (firstChapter?.audioUrl) {
            app.globalData.playingChapter = firstChapter;
            app.globalData.playingIndex = 0;
            this.setData({ currentChapter: firstChapter, currentIndex: 0 });
            this.loadAudio(firstChapter);
            // 通知章节页更新播放状态
            app.notifyCallbacks('onChapterChange', { chapterId: firstChapter._id });
          }
        } else {
          // 顺序播放：停止
          this.setData({ isPlaying: false });
        }
        this._audioEndedProcessing = false;
        return;
      }

      // 播放下一章
      if (chapters[nextIndex]?.audioUrl) {
        const nextChapter = chapters[nextIndex];
        app.globalData.playingChapter = nextChapter;
        app.globalData.playingIndex = nextIndex;
        this.setData({ currentChapter: nextChapter, currentIndex: nextIndex });
        this.loadAudio(nextChapter);
        // 通知章节页更新播放状态
        app.notifyCallbacks('onChapterChange', { chapterId: nextChapter._id });
      } else {
        this.setData({ isPlaying: false });
      }
      this._audioEndedProcessing = false;
    },

    onClose() {
      this.saveProgress(); // 关闭前保存进度
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = []; // 清空播放列表数据
      app.globalData.isFavoriteList = false; // 清除收藏列表标识
      app.notifyCallbacks('onClose', {});
    },

    saveProgress() {
      // 直接从 bgAudioManager 获取当前播放时间，确保是最新的
      const currentTime = this.bgAudioManager.currentTime || this.data.currentTime;
      this.updateProgress(Math.floor(currentTime));
    },

    updateProgress(time, finished) {
      const chapterId = this.data.currentChapter._id;
      // 使用当前章节的 course 字段作为 courseId（支持跨课程播放列表）
      const courseId = this.data.currentChapter.course || this.data.course._id;
      const userId = app.globalData.userId;

      console.log('updateProgress 调用:', { chapterId, courseId, userId, time, finished });

      // 确保 userId、chapterId、courseId 都存在才调用云函数
      if (!userId || !chapterId || !courseId) {
        console.log('updateProgress: userId、chapterId 或 courseId 不存在，跳过更新');
        return;
      }

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
        console.log('updateProgress 结果:', res.result);
        if (res.result.success) {
          // 更新 chapters 数组中对应章节的进度
          const chapters = this.data.chapters.map(ch => {
            if (ch._id === chapterId) {
              // 如果本次设置为完播，更新为"已学完"并设置 lastPlayTime
              if (finished === true) {
                return { ...ch, lastPlayTime: time, finished: true, progress: 100, progressText: '已学完' };
              }
              // 如果之前已完播，保持"已学完"状态，只更新 lastPlayTime
              if (ch.finished) {
                return { ...ch, lastPlayTime: time };
              }
              // 未完播时，根据播放位置计算进度
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
          // 同步到全局数据
          app.globalData.playlistChaptersData = chapters;

          // 通知页面更新进度显示
          app.notifyCallbacks('onProgressUpdate', {
            chapterId: chapterId,
            lastPlayTime: time,
            duration: this.data.duration,
            finished: finished
          });
        }
      }).catch(err => {
        console.error('更新进度失败:', err);
      });
    },

    // 固定图片URL，使用picsum的seed格式保证稳定但刷新时变化
    fixImageUrl(url, coverLoadTime) {
      if (!url) return url;

      // 检查是否包含 _fixed_ 标记，表示固定图片，不替换时间戳
      if (url.includes('picsum.photos/seed/') && url.includes('_fixed_')) {
        return url; // 固定图片，直接返回
      }

      // 检查URL是否已经包含时间戳格式的seed（如 123456_cover_xxx），说明已处理过
      if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_cover_/)) {
        return url; // 已处理过，直接返回
      }

      const loadTime = coverLoadTime || app.globalData.coverLoadTime || Date.now();

      // 处理 picsum.photos URL
      if (url.includes('picsum.photos')) {
        // 如果已经是seed格式（非时间戳格式），替换seed为时间戳+类型+原seed组合
        const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
        if (seedMatch) {
          const originalSeed = seedMatch[1];
          const size = seedMatch[2];
          const newSeed = `${loadTime}_cover_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }

        // 提取尺寸信息
        const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
        const randomMatch = url.match(/random=(\d+)/);

        if (sizeMatch) {
          const size = sizeMatch[1];
          const originalRandom = randomMatch ? randomMatch[1] : '0';
          const seed = `${loadTime}_cover_${originalRandom}`;
          return `https://picsum.photos/seed/${seed}/${size}`;
        }
      }

      // 其他URL直接返回
      return url;
    },

    // 从已处理的URL中提取信息，用新时间戳重新构建
    rebuildImageUrl(url, newLoadTime) {
      if (!url) return url;

      // 如果已经是时间戳格式的seed，提取原始信息替换时间戳
      if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_cover_/)) {
        const seedMatch = url.match(/picsum\.photos\/seed\/(\d+)_cover_([^\/]+)\/(\d+(\/\d+)?)/);
        if (seedMatch) {
          const originalSeed = seedMatch[2];
          const size = seedMatch[3];
          const newSeed = `${newLoadTime}_cover_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }
      }

      // 如果不是已处理的URL，使用 fixImageUrl 处理
      return this.fixImageUrl(url, newLoadTime);
    },

    preventMove() {},

    // 打开播放控制面板
    openPlayerPanel() {
      // 从 bgAudioManager 获取当前状态
      const currentTime = this.bgAudioManager.currentTime || 0;
      const duration = this.bgAudioManager.duration || 0;
      const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

      // 从 bgAudioManager 获取倍速，如果还没设置或不在支持范围内则使用默认值2
      let playbackRate = this.bgAudioManager.playbackRate || 2;
      const supportedRates = [0.75, 1, 1.25, 1.5, 2];
      if (!supportedRates.includes(playbackRate)) {
        playbackRate = 2;
      }

      this.setData({
        showPlayerPanel: true,
        currentTime: currentTime,
        duration: duration,
        progressPercent: progressPercent,
        playbackRate: playbackRate
      });
      this.checkFavoriteStatus();
      this.updateProgressDisplay();
      this.updateSpeedIndicator();
    },

    // 关闭播放控制面板
    closePlayerPanel() {
      this.setData({ showPlayerPanel: false });
    },

    // 播放器面板关闭后回调
    onPlayerPanelLeave() {
      // 面板已完全关闭
    },

    // 检查收藏状态
    checkFavoriteStatus() {
      const chapterId = this.data.currentChapter._id;
      if (!chapterId || !app.globalData.userId) return;

      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'checkFavorite',
          chapterId: chapterId,
          userId: app.globalData.userId
        }
      }).then(res => {
        if (res.result.success) {
          this.setData({ isFavorite: res.result.data.isFavorite });
        }
      }).catch(err => console.error('检查收藏状态失败:', err));
    },

    // 切换收藏
    toggleFavorite() {
      const chapterId = this.data.currentChapter._id;
      if (!chapterId) return;

      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'toggleFavorite',
          chapterId: chapterId,
          courseId: this.data.currentChapter.course || this.data.course._id,
          userId: app.globalData.userId
        }
      }).then(res => {
        if (res.result.success) {
          const newIsFavorite = res.result.data.isFavorite;
          this.setData({ isFavorite: newIsFavorite });
          // 更新 chapters 数组中的收藏状态
          const chapters = this.data.chapters.map(ch =>
            ch._id === chapterId ? { ...ch, isFavorite: newIsFavorite } : ch
          );
          this.setData({ chapters });
          // 同步全局数据
          app.globalData.playlistChaptersData = chapters;
          // 通知其他页面更新收藏状态
          app.notifyCallbacks('onFavoriteChange', { chapterId, isFavorite: newIsFavorite });
          wx.showToast({
            title: newIsFavorite ? '已收藏' : '已取消收藏',
            icon: 'success'
          });
        }
      }).catch(err => {
        console.error('切换收藏失败:', err);
        wx.showToast({ title: '操作失败', icon: 'none' });
      });
    },

    // 切换时间显示
    toggleTimeDisplay() {
      this.setData({ showTotalTime: !this.data.showTotalTime });
      this.updateProgressDisplay();
    },

    // 更新进度显示
    updateProgressDisplay() {
      const { currentTime, duration, showTotalTime } = this.data;
      const current = currentTime || 0;
      const dur = duration || 0;
      const remaining = dur - current;
      this.setData({
        currentTimeText: this.formatTime(current),
        remainingTimeText: showTotalTime ? this.formatTime(dur) : '-' + this.formatTime(remaining > 0 ? remaining : 0)
      });
    },

    // 格式化时间
    formatTime(seconds) {
      if (!seconds || seconds < 0) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // 更新倍速指示器位置
    updateSpeedIndicator() {
      const { playbackRate } = this.data;
      const speeds = [0.75, 1, 1.25, 1.5, 2];
      // 找到最接近的倍速索引
      let index = -1;
      for (let i = 0; i < speeds.length; i++) {
        if (Math.abs(speeds[i] - playbackRate) < 0.01) {
          index = i;
          break;
        }
      }
      // 位置分布：约10%, 30%, 50%, 70%, 90%
      if (index >= 0) {
        const pos = 10 + index * 20;
        this.setData({ speedIndicatorPos: pos });
      } else {
        this.setData({ speedIndicatorPos: 50 });
      }
    },

    // 进度条拖动
    onSliderChanging(e) {
      const value = e.detail.value;
      const duration = this.bgAudioManager.duration;
      const currentTime = (value / 100) * duration;
      this.setData({
        currentTime,
        progressPercent: value
      });
      this.updateProgressDisplay();
    },

    // 进度条变化完成
    onSliderChange(e) {
      const value = e.detail.value;
      const duration = this.bgAudioManager.duration;
      const currentTime = (value / 100) * duration;
      this.bgAudioManager.seek(currentTime);
      this.setData({
        currentTime,
        progressPercent: value
      });
      this.updateProgressDisplay();
    },

    // 快退15秒
    rewind15() {
      const currentTime = this.bgAudioManager.currentTime;
      const newTime = Math.max(0, currentTime - 15);
      this.bgAudioManager.seek(newTime);
    },

    // 快进30秒
    forward30() {
      const currentTime = this.bgAudioManager.currentTime;
      const duration = this.bgAudioManager.duration;
      const newTime = Math.min(duration, currentTime + 30);
      this.bgAudioManager.seek(newTime);
    },

    // 上一条
    playPrev() {
      const { currentIndex, chapters, playMode } = this.data;
      let newIndex;

      if (playMode === 'single') {
        this.bgAudioManager.seek(0);
        this.bgAudioManager.play();
        return;
      }

      if (currentIndex > 0) {
        newIndex = currentIndex - 1;
      } else if (playMode === 'loop') {
        newIndex = chapters.length - 1;
      } else {
        wx.showToast({ title: '已经是第一条', icon: 'none' });
        return;
      }

      this.playChapterByIndex(newIndex);
    },

    // 下一条
    playNext() {
      const { currentIndex, chapters, playMode } = this.data;
      let newIndex;

      if (playMode === 'single') {
        this.bgAudioManager.seek(0);
        this.bgAudioManager.play();
        return;
      }

      if (currentIndex < chapters.length - 1) {
        newIndex = currentIndex + 1;
      } else if (playMode === 'loop') {
        newIndex = 0;
      } else {
        wx.showToast({ title: '已经是最后一条', icon: 'none' });
        this.bgAudioManager.stop();
        this.setData({ isPlaying: false });
        return;
      }

      this.playChapterByIndex(newIndex);
    },

    // 播放指定章节
    playChapterByIndex(index) {
      const { chapters } = this.data;
      if (index < 0 || index >= chapters.length) return;

      const chapter = chapters[index];
      if (!chapter.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      this.saveProgress();

      // 更新数据
      this.setData({
        currentChapter: chapter,
        currentIndex: index
      });

      // 更新全局
      app.globalData.playingChapter = chapter;
      app.globalData.playingIndex = index;

      // 通知章节页更新播放状态
      app.notifyCallbacks('onChapterChange', { chapterId: chapter._id });

      // 播放音频
      this.loadAudio(chapter);

      // 检查收藏状态
      this.checkFavoriteStatus();
      this.updateNextChapterInfo();
    },

    // 切换播放模式
    togglePlayMode() {
      const modes = ['sequence', 'loop', 'single'];
      const currentIdx = modes.indexOf(this.data.playMode);
      const nextIdx = (currentIdx + 1) % modes.length;
      const newMode = modes[nextIdx];

      this.setData({ playMode: newMode });
      app.globalData.playMode = newMode;
      this.updateNextChapterInfo();

      wx.showToast({
        title: newMode === 'sequence' ? '顺序播放' : newMode === 'loop' ? '列表循环' : '单曲循环',
        icon: 'none'
      });
    },

    // 切换排序
    toggleSort() {
      const newOrder = this.data.playlistSortOrder === 'asc' ? 'desc' : 'asc';
      const newChapters = [...this.data.chapters].reverse();

      this.setData({
        playlistSortOrder: newOrder,
        chapters: newChapters,
        currentIndex: newChapters.length - 1 - this.data.currentIndex
      });

      app.globalData.playlistSortOrder = newOrder;
      app.globalData.playlistChaptersData = newChapters;
      this.updateNextChapterInfo();
    },

    // 设置倍速
    setSpeed(e) {
      const rate = e.currentTarget.dataset.rate;
      this.bgAudioManager.playbackRate = rate;
      this.setData({ playbackRate: rate });
      this.updateSpeedIndicator();
    },

    // 倍速条点击（根据点击位置选择倍速）
    onSpeedTrackTap(e) {
      // 如果刚刚进行了滑动，不处理点击
      if (this.speedMoved) {
        this.speedMoved = false;
        return;
      }

      const touch = e.detail.x ? e : e.touches?.[0] || e;
      const clientX = touch.clientX || touch.detail?.x || 0;

      const query = this.createSelectorQuery();
      query.select('.speed-track-wrap').boundingClientRect((rect) => {
        if (!rect) return;
        const x = clientX - rect.left;
        const width = rect.width;
        // 计算位置百分比
        const pos = Math.max(10, Math.min(90, (x / width) * 100));
        // 根据位置计算对应倍速
        const speeds = [0.75, 1, 1.25, 1.5, 2];
        const index = Math.round((pos - 10) / 20);
        const clampedIndex = Math.max(0, Math.min(speeds.length - 1, index));
        const rate = speeds[clampedIndex];
        this.setData({ playbackRate: rate });
        this.bgAudioManager.playbackRate = rate;
        this.updateSpeedIndicator();
      }).exec();
    },

    // 倍速滑动开始
    onSpeedTouchStart(e) {
      this.speedTouching = true;
      this.speedTouchStartX = e.touches[0].clientX;
      this.speedMoved = false;
    },

    // 倍速滑动移动
    onSpeedTouchMove(e) {
      if (!this.speedTouching) return;
      // 如果移动距离大于10px，认为是滑动而非点击
      const moveDistance = Math.abs(e.touches[0].clientX - this.speedTouchStartX);
      if (moveDistance > 10) {
        this.speedMoved = true;
      }

      const touch = e.touches[0];
      const query = this.createSelectorQuery();
      query.select('.speed-track-wrap').boundingClientRect((rect) => {
        if (!rect) return;
        const x = touch.clientX - rect.left;
        const width = rect.width;
        // 计算位置百分比
        const pos = Math.max(10, Math.min(90, (x / width) * 100));
        // 根据位置计算对应倍速
        const speeds = [0.75, 1, 1.25, 1.5, 2];
        const index = Math.round((pos - 10) / 20);
        const clampedIndex = Math.max(0, Math.min(speeds.length - 1, index));
        const rate = speeds[clampedIndex];
        this.setData({ playbackRate: rate });
        this.bgAudioManager.playbackRate = rate;
        this.updateSpeedIndicator();
      }).exec();
    },

    // 倍速滑动结束
    onSpeedTouchEnd(e) {
      this.speedTouching = false;
    },

    // 播放/暂停切换
    togglePlayPause() {
      if (this.data.isPlaying) {
        this.bgAudioManager.pause();
        this.saveProgress();
      } else {
        this.bgAudioManager.play();
      }
    },

    // 更新下一条信息
    updateNextChapterInfo() {
      const { chapters, currentIndex, playMode } = this.data;
      if (!chapters || chapters.length === 0) {
        this.setData({ nextChapterSeq: '', nextChapterTitle: '' });
        return;
      }
      // 单曲循环模式：下一条就是当前条
      if (playMode === 'single') {
        const current = chapters[currentIndex];
        this.setData({ nextChapterSeq: current.seq, nextChapterTitle: current.title });
        return;
      }
      // 列表循环模式：最后一条的下一条是第一条
      if (playMode === 'loop' && currentIndex === chapters.length - 1) {
        const first = chapters[0];
        this.setData({ nextChapterSeq: first.seq, nextChapterTitle: first.title });
        return;
      }
      // 顺序播放模式：最后一条显示提示
      if (currentIndex === chapters.length - 1) {
        this.setData({ nextChapterSeq: '', nextChapterTitle: '已经是最后一条' });
        return;
      }
      // 其他情况：显示下一条
      const next = chapters[currentIndex + 1];
      this.setData({ nextChapterSeq: next.seq, nextChapterTitle: next.title });
    },

    // 开始封面旋转（根据排序方向）
    startCoverRotation() {
      if (this.rotationTimer) return; // 已在旋转
      // 每50ms更新一次角度，12秒一圈 = 360/(12*1000/50) = 1.5度每次
      const rotationSpeed = 1.5;
      this.rotationTimer = setInterval(() => {
        const { coverRotationAngle, playlistSortOrder } = this.data;
        // 正序顺时针（角度增加），倒序逆时针（角度减少）
        // 不使用取模，让角度连续累加，CSS会自动处理周期性
        const newAngle = playlistSortOrder === 'asc'
          ? coverRotationAngle + rotationSpeed
          : coverRotationAngle - rotationSpeed;
        this.setData({ coverRotationAngle: newAngle });
      }, 50);
    },

    // 停止封面旋转（保持当前角度）
    stopCoverRotation() {
      if (this.rotationTimer) {
        clearInterval(this.rotationTimer);
        this.rotationTimer = null;
      }
    },

    // 播放列表相关方法
    onPlaylistTap() {
      const playlistPanel = this.selectComponent('#playlistPanel');
      if (playlistPanel) playlistPanel.show();
    },

    onPlaylistCollapse() {
      // 播放列表收起
    },

    onPlaylistClear() {
      // 清空播放列表：停止播放，清空数据
      this.stopCoverRotation();
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = [];
      app.globalData.isFavoriteList = false;
      this.setData({ visible: false, isPlaying: false, chapters: [], isFavoriteList: false, coverRotationAngle: 0, nextChapterSeq: '', nextChapterTitle: '' });
    },

    onPlaylistSyncSort(e) {
      // 播放列表排序变化，同步更新 chapters，并重新计算当前播放索引
      const sortedChapters = e.detail.chapters;
      const currentId = this.data.currentChapter._id;
      const newIndex = sortedChapters.findIndex(ch => ch._id === currentId);
      this.setData({ chapters: sortedChapters, currentIndex: newIndex });
      app.globalData.playingIndex = newIndex;
      this.updateNextChapterInfo();
    },

    onPlaylistPlay(e) {
      const { chapterId, index } = e.detail;
      const chapter = this.data.chapters.find(ch => ch._id === chapterId);

      // 如果点击的是当前正在播放的章节，切换播放/暂停状态
      if (chapterId === this.data.currentChapter._id) {
        if (this.data.isPlaying) {
          this.bgAudioManager.pause();
          this.saveProgress();
          // 通知章节页暂停状态
          app.notifyCallbacks('onPlayPause', { chapterId, isPlaying: false });
        } else {
          this.bgAudioManager.play();
          // 通知章节页播放状态
          app.notifyCallbacks('onPlayPause', { chapterId, isPlaying: true });
        }
        return;
      }

      // 切换到新章节前，先保存当前播放进度
      if (this.data.currentChapter._id && this.data.isPlaying) {
        this.saveProgress();
      }

      // 播放新章节
      if (chapter?.audioUrl) {
        app.globalData.playingChapter = chapter;
        app.globalData.playingIndex = index;
        this.setData({
          currentChapter: chapter,
          currentIndex: index,
          isPlaying: false
        });
        this.loadAudio(chapter);
        // 通知章节页更新播放状态
        app.notifyCallbacks('onChapterChange', { chapterId: chapter._id });
        this.updateNextChapterInfo();
      }
    },

    onPlaylistDelete(e) {
      const { chapterId } = e.detail;
      const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
      this.setData({ chapters });
      // 更新全局播放列表数据
      app.globalData.playlistChaptersData = chapters;

      // 如果删除的是当前播放的章节，自动播放下一条
      if (chapterId === this.data.currentChapter._id) {
        // 正在播放时删除，保存播放进度
        if (this.data.isPlaying) {
          this.saveProgress();
        }

        const nextIndex = this.data.currentIndex;
        if (nextIndex < chapters.length && chapters[nextIndex]?.audioUrl) {
          const nextChapter = chapters[nextIndex];
          app.globalData.playingChapter = nextChapter;
          app.globalData.playingIndex = nextIndex;
          this.setData({
            currentChapter: nextChapter,
            currentIndex: nextIndex
          });
          this.loadAudio(nextChapter);
          // 通知章节页更新播放状态
          app.notifyCallbacks('onChapterChange', { chapterId: nextChapter._id });
          this.updateNextChapterInfo();
        } else {
          this.bgAudioManager.stop();
          app.globalData.miniPlayerActive = false;
          app.globalData.playlistChaptersData = [];
          this.setData({ visible: false, isPlaying: false, nextChapterSeq: '', nextChapterTitle: '' });
          // 通知章节页清除播放状态
          app.notifyCallbacks('onStop', {});
        }
      } else {
        this.updateNextChapterInfo();
      }
    }
  }
});