// index.js
const app = getApp();

// 金庸人物列表（200人）
const AUTHORS = [
  '郭靖','黄蓉','黄药师','欧阳锋','洪七公','周伯通','一灯大师','梅超风','杨康','穆念慈',
  '丘处机','马钰','柯镇恶','华筝','拖雷','铁木真','欧阳克','完颜洪烈','瑛姑','裘千仞',
  '冯衡','陆乘风','程瑶迦','陆冠英','尹志平','杨过','小龙女','郭襄','李莫愁','金轮法王',
  '公孙止','裘千尺','耶律齐','霍都','达尔巴','陆无双','程英','公孙绿萼','洪凌波','郭芙',
  '武三通','孙婆婆','甄志丙','赵志敬','独孤求败','张无忌','赵敏','周芷若','小昭','殷离',
  '张三丰','谢逊','杨逍','范遥','殷天正','韦一笑','灭绝师太','成昆','宋青书','纪晓芙',
  '殷素素','张翠山','宋远桥','俞莲舟','殷梨亭','金花婆婆','黛绮丝','陈友谅','朱元璋','胡青牛',
  '乔峰','段誉','虚竹','王语嫣','阿朱','阿紫','慕容复','鸠摩智','段正淳','扫地僧',
  '天山童姥','李秋水','无崖子','丁春秋','段延庆','叶二娘','岳老三','云中鹤','木婉清','钟灵',
  '阿碧','包不同','风波恶','萧远山','慕容博','令狐冲','任盈盈','岳不群','宁中则','林平之',
  '岳灵珊','东方不败','任我行','向问天','左冷禅','风清扬','方证大师','冲虚道长','莫大先生','刘正风',
  '曲洋','余沧海','定闲师太','蓝凤凰','平一指','韦小宝','康熙','双儿','阿珂','苏荃',
  '方怡','沐剑屏','曾柔','建宁公主','陈近南','鳌拜','索额图','明珠','施琅','茅十八',
  '九难师太','洪教主','胖头陀','瘦头陀','吴三桂','陈家洛','霍青桐','香香公主','文泰来','骆冰',
  '无尘道长','赵半山','周绮','章进','余万亭','天山双鹰','袁士霄','阿凡提','张召重','周仲英',
  '袁承志','温青青','金蛇郎君','何红药','温仪','穆人清','归辛树','归二娘','何铁手','李自成',
  '焦宛儿','安小慧','黄真','刘宗敏','袁崇焕','胡斐','苗若兰','苗人凤','胡一刀','南兰',
  '田归农','宝树和尚','平阿四','凤天南','陶百岁','狄云','戚芳','水笙','丁典','凌霜华',
  '万震山','万圭','血刀老祖','石破天','石中玉','白自在','谢烟客','贝海石','丁不三','丁不四',
  '阿绣','李文秀','苏普','阿青','范蠡','西施','勾践','袁冠男','萧中慧','卓天雄',
  '林玉龙','任飞燕','太岳四侠'
];

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    scrollHeightNoTab: 0,
    scrollHeightWithTab: 0,
    isLoggedIn: false,
    courses: [],
    headlines: [],
    bannerSpeed: 5000,
    homeProtect: true,
    loading: true,
    activeTab: 0,
    refreshing: false,
    maskedAuthors: {},
    bannerTime: 0,
    coverTime: 0,
    logoutConfirmVisible: false // 退出登录确认弹窗
  },

  onLoad() {
    this.initLayout();
    this.initTimes();
    this.initCache();
    this.checkLogin();
  },

  initLayout() {
    const { statusBarHeight, windowHeight, windowWidth } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    const tabH = 100 * windowWidth / 750; // 100rpx 转 px

    this.setData({
      statusBarHeight,
      navBarHeight,
      headerHeight,
      scrollHeightNoTab: windowHeight - headerHeight,
      scrollHeightWithTab: windowHeight - headerHeight - tabH
    });
  },

  initTimes() {
    if (!app.globalData.bannerLoadTime) app.globalData.bannerLoadTime = Date.now();
    if (!app.globalData.coverLoadTime) app.globalData.coverLoadTime = Date.now();
    if (!app.globalData.homePageMaskedAuthors) app.globalData.homePageMaskedAuthors = {};

    this.setData({
      bannerTime: app.globalData.bannerLoadTime,
      coverTime: app.globalData.coverLoadTime,
      maskedAuthors: app.globalData.homePageMaskedAuthors
    });
  },

  initCache() {
    // 优先从本地存储读取缓存，避免空白页
    let headlines = app.globalData.indexHeadlines;
    let courses = app.globalData.indexCourses;

    if (!headlines?.length) {
      headlines = wx.getStorageSync('indexHeadlines') || [];
      app.globalData.indexHeadlines = headlines;
    }
    if (!courses?.length) {
      courses = wx.getStorageSync('indexCourses') || [];
      app.globalData.indexCourses = courses;
    }

    // 如果有缓存，需要用当前时间戳重建 URL
    const bannerTime = app.globalData.bannerLoadTime;
    const coverTime = app.globalData.coverLoadTime;
    if (headlines.length > 0) {
      headlines = headlines.map(h => ({
        ...h,
        image: this.processUrl(h.image, bannerTime, 'banner')
      }));
    }
    if (courses.length > 0) {
      courses = courses.map(c => ({
        ...c,
        cover: this.processUrl(c.cover, coverTime, 'cover')
      }));
    }

    this.setData({
      headlines,
      courses,
      loading: !courses.length // 有缓存则不显示loading
    });

    // 始终检查是否需要恢复真实课程（避免闪烁）
    this.maskCourses();

    if (!headlines.length) this.loadHeadlines();
    // 只有当 courses 确实为空时才加载（maskCourses 可能已恢复真实课程）
    if (!this.data.courses.length) this.loadCourses();
  },

  onShow() {
    this.checkLogin();
    this.syncTimes();
    this.showStatusToast();
  },

  syncTimes() {
    const bt = app.globalData.bannerLoadTime;
    const ct = app.globalData.coverLoadTime;

    if (bt !== this.data.bannerTime) {
      const headlines = this.data.headlines.map(h => ({
        ...h, image: this.processUrl(h.image, bt, 'banner')
      }));
      this.setData({ bannerTime: bt, headlines });
      app.globalData.indexHeadlines = headlines; // 同步回全局缓存
    }

    if (ct !== this.data.coverTime) {
      const courses = this.data.courses.map(c => ({
        ...c, cover: this.processUrl(c.cover, ct, 'cover')
      }));
      this.setData({ coverTime: ct, courses });
      app.globalData.indexCourses = courses; // 同步回全局缓存
      this.maskCourses();
    }
  },

  showStatusToast() {
    if (app.globalData.loginFlag) {
      app.globalData.loginFlag = false;
      setTimeout(() => wx.showToast({ title: '已登录', icon: 'success' }), 500);
    } else if (app.globalData.logoutFlag) {
      app.globalData.logoutFlag = false;
      setTimeout(() => wx.showToast({ title: '已退出登录', icon: 'success' }), 500);
    }
  },

  processUrl(url, time, type) {
    if (!url || url.includes('seed/fixed_')) return url;
    const t = time || this.data[type === 'banner' ? 'bannerTime' : 'coverTime'];

    // 已有时间戳格式，更新时间戳
    const m1 = url.match(/seed\/(\d+)_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
    if (m1 && m1[1] != t) {
      return url.replace(/seed\/\d+_(banner|cover)_/, `seed/${t}_${type}_`);
    }
    if (m1) return url;

    // seed格式（非时间戳），添加时间戳
    const m2 = url.match(/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
    if (m2) return `https://picsum.photos/seed/${t}_${type}_${m2[1]}/${m2[2]}`;

    // 无seed格式
    const m3 = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
    if (m3) {
      const r = url.match(/random=(\d+)/)?.[1] || '0';
      return `https://picsum.photos/seed/${t}_${type}_${r}/${m3[1]}`;
    }

    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  onRefresh() {
    const t = Date.now();
    app.globalData.bannerLoadTime = t;
    app.globalData.coverLoadTime = t;
    wx.setStorageSync('bannerLoadTime', t);
    wx.setStorageSync('coverLoadTime', t);
    app.globalData.indexHeadlines = [];
    app.globalData.indexCourses = [];
    console.log('[Index] onRefresh, bannerLoadTime:', t);
    // 不再清空其他页面的缓存（loginHeadlines, favoriteHeadlines, mineHeadlines）
    // 各页面通过 onShow 检测 bannerLoadTime 变化来同步图片

    const newAuthors = {};
    this.data.courses.forEach(c => newAuthors[c._id] = AUTHORS[Math.floor(Math.random() * AUTHORS.length)]);
    app.globalData.homePageMaskedAuthors = newAuthors;
    app.notifyCallbacks?.('onCoverRefresh', { coverLoadTime: t });

    this.setData({ refreshing: true, bannerTime: t, coverTime: t, maskedAuthors: newAuthors, headlines: [], courses: [] });

    Promise.all([this.loadHeadlines(), this.loadCourses()]).then(() => {
      this.setData({ refreshing: false });
    });
  },

  loadHeadlines() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'index' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({ ...h, image: this.processUrl(h.image, null, 'banner') }));
        app.globalData.indexHeadlines = headlines;
        wx.setStorageSync('indexHeadlines', headlines);
        this.setData({
          headlines,
          bannerSpeed: (res.result.speed || 5) * 1000,
          homeProtect: res.result.homeProtect !== false
        });
        this.maskCourses();
      }
    }).catch(e => console.error('获取头条失败', e));
  },

  loadCourses() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourses', limit: 20, filterDraft: true, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) {
        const courses = res.result.data.map(c => ({ ...c, cover: this.processUrl(c.cover, null, 'cover') }));
        app.globalData.indexCourses = courses;
        wx.setStorageSync('indexCourses', courses);
        this.setData({ courses, loading: false });
        this.maskCourses();
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => this.setData({ loading: false }));
  },

  maskCourses() {
    const { homeProtect, isLoggedIn, courses, maskedAuthors } = this.data;
    if (!homeProtect || isLoggedIn) {
      // 已登录或首页保护关闭，恢复真实课程数据
      const realCourses = app.globalData.indexCourses || wx.getStorageSync('indexCourses') || [];
      if (realCourses.length && this.data.courses.some(c => c.title === '登录后可见')) {
        this.setData({ courses: realCourses });
      }
      return;
    }

    const newAuthors = { ...maskedAuthors };
    const masked = courses.map(c => {
      let author = newAuthors[c._id];
      if (!author) {
        author = AUTHORS[Math.floor(Math.random() * AUTHORS.length)];
        newAuthors[c._id] = author;
      }
      return { ...c, title: '登录后可见', author };
    });

    app.globalData.homePageMaskedAuthors = newAuthors;
    this.setData({ courses: masked, maskedAuthors: newAuthors });
  },

  checkLogin() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn || false });
    this.maskCourses();
    // 如果已登录但没有课程数据（realCourses为空），加载课程
    if (app.globalData.isLoggedIn) {
      const realCourses = app.globalData.indexCourses || wx.getStorageSync('indexCourses') || [];
      if (realCourses.length === 0 && !this.data.loading) {
        this.loadCourses();
      }
    }
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      // 已登录，显示退出确认弹窗
      this.setData({ logoutConfirmVisible: true });
    } else {
      // 未登录，跳转到登录页
      wx.navigateTo({ url: '/pages/login/index' });
    }
  },

  // 取消退出登录
  onLogoutCancel() {
    this.setData({ logoutConfirmVisible: false });
  },

  // 确认退出登录
  onLogoutConfirm() {
    this.setData({ logoutConfirmVisible: false });

    // 停止播放器并清空播放状态
    app.bgAudioManager.stop();
    app.globalData.miniPlayerActive = false;
    app.globalData.miniPlayerIndexFadedIn = false;
    app.globalData.playingCourse = null;
    app.globalData.playingChapter = null;
    app.globalData.playingIndex = 0;
    app.globalData.playlistChaptersData = [];
    app.globalData.favoriteChapters = [];
    app.globalData.playMode = 'sequence';
    app.globalData.playlistSortOrder = 'asc';
    app.notifyCallbacks?.('onClose', {});

    // 清除登录状态
    app.globalData.isLoggedIn = false;
    app.globalData.userInfo = null;
    app.globalData.userId = null;
    wx.removeStorageSync('userId');
    wx.removeStorageSync('userInfo');

    // 刷新当前页面状态
    this.setData({ isLoggedIn: false });
    this.maskCourses();

    // 显示退出提示（不设置 logoutFlag，避免切回首页时重复显示）
    setTimeout(() => wx.showToast({ title: '已退出登录', icon: 'success' }), 300);
  },

  onCourseTap(e) {
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    wx.navigateTo({ url: `/pages/chapter/index?id=${e.currentTarget.dataset.id}` });
  },

  onTabChange(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx == 0) return;
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    const targetUrl = `/pages/${['', 'favorite', 'mine'][idx]}/index`;
    const pages = getCurrentPages();
    const targetPage = pages.find(p => p.route === `pages/${['', 'favorite', 'mine'][idx]}/index`);
    if (targetPage) {
      const delta = pages.length - pages.indexOf(targetPage) - 1;
      if (delta > 0) {
        wx.navigateBack({ delta });
      } else {
        wx.navigateTo({ url: targetUrl });
      }
    } else {
      wx.navigateTo({ url: targetUrl });
    }
  }
});