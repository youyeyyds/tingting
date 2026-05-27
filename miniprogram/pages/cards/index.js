// cards/index.js
const app = getApp();

Page({
  data: {
    cards: [],
    currentIndex: 0,
    currentCard: null,
    isFlipped: false,
    loading: true,
    headerHeight: 0,
    defaultCardFace: null
  },

  onLoad() {
    this.initLayout();
    this.loadCards();
  },

  initLayout() {
    const { statusBarHeight, windowHeight, windowWidth } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    this.setData({ headerHeight });
  },

  async loadCards() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'getCards' }
      });
      if (res.result.success) {
        let cards = res.result.data || [];
        // 重新获取图片签名，避免过期
        cards = await this.refreshCardImageUrls(cards);
        this.setData({
          cards,
          currentCard: cards[0] || null,
          currentIndex: 0,
          defaultCardFace: res.result.defaultCardFace || null
        });
      }
    } catch (err) {
      console.error('获取卡牌失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 刷新卡牌图片URL（获取新的临时签名）
  async refreshCardImageUrls(cards) {
    if (!cards || cards.length === 0) return cards;
    // 使用 imageFileID（cloud://格式）获取新签名
    const fileList = cards.map(card => card.imageFileID).filter(Boolean);
    if (fileList.length === 0) return cards;
    try {
      const res = await wx.cloud.getTempFileURL({ fileList });
      const urlMap = {};
      (res.fileList || []).forEach((item, index) => {
        if (fileList[index]) {
          urlMap[fileList[index]] = item.tempFileURL || fileList[index];
        }
      });
      return cards.map(card => ({
        ...card,
        image: card.imageFileID && urlMap[card.imageFileID] ? urlMap[card.imageFileID] : card.image
      }));
    } catch (err) {
      console.error('刷新卡牌图片URL失败', err);
      return cards;
    }
  },

  onCardTap() {
    this.setData({ isFlipped: !this.data.isFlipped });
  },

  onPrev() {
    if (this.data.currentIndex <= 0) return;
    const newIndex = this.data.currentIndex - 1;
    this.setData({
      currentIndex: newIndex,
      currentCard: this.data.cards[newIndex],
      isFlipped: false
    });
  },

  onNext() {
    if (this.data.currentIndex >= this.data.cards.length - 1) return;
    const newIndex = this.data.currentIndex + 1;
    this.setData({
      currentIndex: newIndex,
      currentCard: this.data.cards[newIndex],
      isFlipped: false
    });
  },

  onImageLoad() {
    // 图片加载完成
  },

  onImageError() {
    wx.showToast({ title: '图片加载失败', icon: 'none' });
  }
});