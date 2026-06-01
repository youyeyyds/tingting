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
    defaultCardFace: null,
    cardAnimation: 'center', // center | left-out | right-in | right-out | left-in
    isTransitioning: false
  },

  onLoad() {
    this.setData({ headerHeight: app.globalData.headerHeight });
    this.loadCards();
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
    if (this.data.isTransitioning) return;
    this.setData({ isFlipped: !this.data.isFlipped });
  },

  onPrev() {
    if (this.data.currentIndex <= 0 || this.data.isTransitioning) return;
    this.playTransition('left');
  },

  onNext() {
    if (this.data.currentIndex >= this.data.cards.length - 1 || this.data.isTransitioning) return;
    this.playTransition('right');
  },

  playTransition(direction) {
    const outAnim = direction === 'right' ? 'left-out' : 'right-out';
    const inAnim = direction === 'right' ? 'right-in' : 'left-in';

    this.setData({ cardAnimation: outAnim, isTransitioning: true });

    setTimeout(() => {
      const newIndex = direction === 'right'
        ? this.data.currentIndex + 1
        : this.data.currentIndex - 1;
      const newCard = this.data.cards[newIndex];
      // 如果没有图片则使用默认卡面
      if (!newCard.image) {
        newCard.image = this.data.defaultCardFace;
      }
      this.setData({
        currentIndex: newIndex,
        currentCard: newCard,
        cardAnimation: inAnim,
        isFlipped: false
      });

      setTimeout(() => {
        this.setData({ cardAnimation: 'center', isTransitioning: false });
      }, 300);
    }, 300);
  },

  onImageLoad() {
    // 图片加载完成时预加载其他卡牌
    this.preloadNearbyCards();
  },

  // 预加载当前卡牌附近的几张卡牌图片
  preloadNearbyCards() {
    const { cards, currentIndex } = this.data;
    if (!cards || cards.length === 0) return;
    // 预加载当前、前后各一张
    const toPreload = [currentIndex - 1, currentIndex + 1, currentIndex + 2];
    toPreload.forEach(index => {
      if (index >= 0 && index < cards.length && cards[index] && cards[index].image) {
        wx.downloadFile({ url: cards[index].image });
      }
    });
  },

  onImageError() {
    wx.showToast({ title: '图片加载失败', icon: 'none' });
  }
});