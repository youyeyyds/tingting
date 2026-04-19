// index.js
const app = getApp();

// 随机作者名称列表（金庸小说人物，共100个）
const randomAuthors = [
  // 射雕英雄传
  '郭靖', '黄蓉', '黄药师', '欧阳锋', '洪七公', '周伯通', '一灯大师', '梅超风', '杨康', '穆念慈',
  '柯镇恶', '朱聪', '韩宝驹', '韩小莹', '丘处机', '马钰', '瑛姑', '欧阳克', '完颜洪烈', '鲁有脚',
  // 神雕侠侣
  '杨过', '小龙女', '郭襄', '李莫愁', '陆无双', '程英', '公孙止', '裘千尺', '耶律齐', '金轮法王',
  '霍都', '达尔巴', '赵志敬', '甄志丙', '孙婆婆', '独孤求败', '洪凌波', '武修文', '武敦儒', '完颜萍',
  // 倚天屠龙记
  '张无忌', '赵敏', '周芷若', '小昭', '殷离', '谢逊', '张三丰', '宋远桥', '俞莲舟', '俞岱岩',
  '张翠山', '殷梨亭', '莫声谷', '成昆', '杨逍', '范遥', '殷天正', '韦一笑', '灭绝师太', '纪晓芙',
  // 天龙八部
  '乔峰', '段誉', '虚竹', '王语嫣', '阿朱', '阿紫', '慕容复', '游坦之', '鸠摩智', '段正淳',
  '天山童姥', '李秋水', '无崖子', '丁春秋', '苏星河', '段延庆', '叶二娘', '岳老三', '云中鹤', '木婉清',
  // 笑傲江湖
  '令狐冲', '任盈盈', '岳不群', '宁中则', '林平之', '岳灵珊', '左冷禅', '向问天', '任我行', '东方不败',
  '童柏熊', '黄钟公', '黑白子', '秃笔翁', '丹青生', '莫大先生', '刘正风', '曲洋', '定闲师太', '余沧海',
  // 鹿鼎记及其他
  '韦小宝', '陈近南', '康熙', '双儿', '阿珂', '苏荃', '方怡', '沐剑屏', '曾柔', '建宁公主',
  '袁承志', '温青青', '金蛇郎君', '胡斐', '苗若兰', '苗人凤', '狄云', '戚芳', '石破天', '叮叮当当'
];

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    isLoggedIn: false,
    courses: [],
    headlines: [],
    bannerSpeed: 3000,
    homeProtect: true, // 默认开启首页保护
    loading: true,
    activeTab: 0,
    refresherTriggered: false
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: windowInfo.statusBarHeight + navBarHeight
    });

    this.checkLoginStatus();
    this.loadHeadlinesAsync();
    this.loadCoursesAsync();
  },

  onShow() {
    this.checkLoginStatus();
    this.loadHeadlinesAsync();
    this.loadCoursesAsync();
  },

  onRefresh() {
    this.setData({ refresherTriggered: true });
    Promise.all([
      this.loadHeadlinesAsync(),
      this.loadCoursesAsync()
    ]).then(() => {
      this.setData({ refresherTriggered: false });
    });
  },

  loadHeadlinesAsync() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'index' }
    })
    .then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.addTimestamp(h.image)
        }));
        this.setData({
          headlines: headlines,
          bannerSpeed: (res.result.speed || 3) * 1000,
          homeProtect: res.result.homeProtect !== false
        });
        this.processCourses();
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  loadCoursesAsync() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'getCourses',
        limit: 20,
        filterDraft: true,
        userId: app.globalData.userId
      }
    })
    .then(res => {
      if (res.result.success) {
        const courses = res.result.data.map(c => ({
          ...c,
          cover: this.addTimestamp(c.cover)
        }));
        this.setData({
          courses: courses,
          loading: false
        });
        this.processCourses();
      } else {
        this.setData({ loading: false });
      }
    })
    .catch(err => {
      this.setData({ loading: false });
    });
  },

  addTimestamp(url) {
    if (!url) return url;
    const t = Date.now();
    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  // 处理课程显示（根据首页保护和登录状态）
  processCourses() {
    const { homeProtect, isLoggedIn, courses } = this.data;
    if (!homeProtect || isLoggedIn) {
      // 首页保护关闭或已登录，显示真实数据
      return;
    }
    // 首页保护开启且未登录，隐藏课程信息
    const maskedCourses = courses.map(course => ({
      ...course,
      title: '登录后可见',
      author: randomAuthors[Math.floor(Math.random() * randomAuthors.length)]
    }));
    this.setData({ courses: maskedCourses });
  },

  checkLoginStatus() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn || false });
    this.processCourses();
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      // 退出登录
      // 停止播放器并清空播放状态
      app.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = [];
      app.globalData.playMode = 'sequence';
      app.globalData.playlistSortOrder = 'asc';
      // 通知 mini-player 关闭
      app.notifyCallbacks('onClose', {});

      app.globalData.isLoggedIn = false;
      app.globalData.userInfo = null;
      app.globalData.userId = null;
      wx.removeStorageSync('userId');
      wx.removeStorageSync('userInfo');
      this.setData({ isLoggedIn: false });
      // 重新加载课程（应用首页保护）
      this.loadCourses();
      wx.showToast({ title: '已退出', icon: 'success' });
    } else {
      // 跳转到登录页
      wx.navigateTo({ url: '/pages/login/index' });
    }
  },

  onCourseTap(e) {
    // 检查登录状态，未登录则跳转到登录页
    if (!app.globalData.isLoggedIn || !app.globalData.userId) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    wx.navigateTo({ url: `/pages/chapter/index?id=${e.currentTarget.dataset.id}` });
  },

  onHeadlineTap(e) {
    // 横幅点击不做任何操作
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index === 0) return;
    // 未登录时，首页、收藏、我的都跳转登录页
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    wx.redirectTo({ url: `/pages/${['', 'favorite', 'mine'][index]}/index` });
  }
});