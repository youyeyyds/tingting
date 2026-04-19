// index.js
const app = getApp();

// 随机作者名称列表（金庸小说人物，共200个）
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
  // 鹿鼎记
  '韦小宝', '陈近南', '康熙', '双儿', '阿珂', '苏荃', '方怡', '沐剑屏', '曾柔', '建宁公主',
  '鳌拜', '索额图', '明珠', '施琅', '风际中', '徐天川', '澄观', '澄光', '白寒松', '白寒松',
  // 书剑恩仇录
  '陈家洛', '霍青桐', '香香公主', '文泰来', '骆冰', '余万亭', '无尘道长', '赵半山', '徐天川', '心砚',
  '周绮', '孟健雄', '章进', '卫春华', '石双英', '蒋四根', '杨成协', '常赫志', '常伯志', '哈合台',
  // 碧血剑
  '袁承志', '温青青', '金蛇郎君', '何红药', '温仪', '温方山', '温方施', '温方悟', '温方禄', '穆人清',
  '黄真', '归辛树', '归二娘', '何铁手', '五毒教主', '李自成', '刘宗敏', '宋献策', '田见秀', '袁崇焕',
  // 雪山飞狐
  '胡斐', '苗若兰', '苗人凤', '胡一刀', '南兰', '田归农', '商宝震', '阎基', '杜希孟', '平阿四',
  '宝树和尚', '陶百岁', '殷吉', '刘元鹤', '曹云奇', '周云阳', '阮士中', '姬晓峰', '欧阳公政', '上官铁生',
  // 连城诀
  '狄云', '戚芳', '水笙', '丁典', '凌霜华', '万震山', '万圭', '言达平', '戚长发', '花铁干',
  // 侠客行
  '石破天', '叮叮当当', '石中玉', '白自在', '史小翠', '谢烟客', '贝海石', '白万剑', '花万紫', '侍剑',
  '阿绣', '丁不三', '丁不四', '梅文馨', '欢喜老祖', '上清观主', '愚茶道长', '桂香婆婆', '冲虚道长', '清虚道长'
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
    refresherTriggered: false,
    maskedAuthors: {}, // 存储课程ID对应的随机作者
    loadTime: '', // 加载时间戳
    pageAnimating: false // 页面退出动画
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;

    // 使用全局 loadTime 和 maskedAuthors，保持图片稳定
    if (!app.globalData.homePageLoadTime) {
      app.globalData.homePageLoadTime = Date.now();
    }
    if (!app.globalData.homePageMaskedAuthors) {
      app.globalData.homePageMaskedAuthors = {};
    }
    const loadTime = app.globalData.homePageLoadTime;
    const maskedAuthors = app.globalData.homePageMaskedAuthors;

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: windowInfo.statusBarHeight + navBarHeight,
      loadTime: loadTime,
      maskedAuthors: maskedAuthors
    });

    this.checkLoginStatus();
    this.loadHeadlinesAsync();
    this.loadCoursesAsync();
  },

  onShow() {
    this.checkLoginStatus();
    // 切换页面时不重新加载，保持原有数据
  },

  onRefresh() {
    const newLoadTime = Date.now();
    // 重新生成随机作者
    const newMaskedAuthors = {};
    this.data.courses.forEach(course => {
      newMaskedAuthors[course._id] = randomAuthors[Math.floor(Math.random() * randomAuthors.length)];
    });
    // 更新全局变量
    app.globalData.homePageLoadTime = newLoadTime;
    app.globalData.homePageMaskedAuthors = newMaskedAuthors;
    this.setData({ refresherTriggered: true, loadTime: newLoadTime, maskedAuthors: newMaskedAuthors });
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
    const t = this.data.loadTime;
    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  // 处理课程显示（根据首页保护和登录状态）
  processCourses() {
    const { homeProtect, isLoggedIn, courses, maskedAuthors } = this.data;
    if (!homeProtect || isLoggedIn) {
      // 首页保护关闭或已登录，显示真实数据
      return;
    }
    // 首页保护开启且未登录，隐藏课程信息
    const newMaskedAuthors = { ...maskedAuthors };
    const maskedCourses = courses.map(course => {
      let randomAuthor = maskedAuthors[course._id];
      if (!randomAuthor) {
        randomAuthor = randomAuthors[Math.floor(Math.random() * randomAuthors.length)];
        newMaskedAuthors[course._id] = randomAuthor;
      }
      return {
        ...course,
        title: '登录后可见',
        author: randomAuthor
      };
    });
    // 更新全局和本地状态
    app.globalData.homePageMaskedAuthors = newMaskedAuthors;
    this.setData({ courses: maskedCourses, maskedAuthors: newMaskedAuthors });
  },

  checkLoginStatus() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn || false });
    this.processCourses();
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      // 已登录时，触发动画后跳转到个人页面
      this.setData({ pageAnimating: true });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/mine/index' });
      }, 200);
    } else {
      // 未登录时跳转到登录页
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