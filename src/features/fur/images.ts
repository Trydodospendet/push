import type { ImageSourcePropType } from 'react-native';

/** Fur-style images from assets/fur (see scripts/finish-fur-assets.js). */
export const furImages = {
  digits: [
    require('../../../assets/fur/0.webp'),
    require('../../../assets/fur/1.webp'),
    require('../../../assets/fur/2.webp'),
    require('../../../assets/fur/3.webp'),
    require('../../../assets/fur/4.webp'),
    require('../../../assets/fur/5.webp'),
    require('../../../assets/fur/6.webp'),
    require('../../../assets/fur/7.webp'),
    require('../../../assets/fur/8.webp'),
    require('../../../assets/fur/9.webp'),
  ] as ImageSourcePropType[],
  comma: require('../../../assets/fur/comma.webp') as ImageSourcePropType,
  units: {
    km: require('../../../assets/fur/km.webp') as ImageSourcePropType,
    kmh: require('../../../assets/fur/kmh.webp') as ImageSourcePropType,
    schritte: require('../../../assets/fur/schritte.webp') as ImageSourcePropType,
  },
  push: require('../../../assets/fur/push.webp') as ImageSourcePropType,
  pushy: {
    sit: require('../../../assets/fur/pushy-sit.webp') as ImageSourcePropType,
    run: require('../../../assets/fur/pushy-run.webp') as ImageSourcePropType,
    cheer: require('../../../assets/fur/pushy-cheer.webp') as ImageSourcePropType,
    dizzy: require('../../../assets/fur/pushy-dizzy.webp') as ImageSourcePropType,
    sad: require('../../../assets/fur/pushy-sad.webp') as ImageSourcePropType,
    sleep: require('../../../assets/fur/pushy-sleep.webp') as ImageSourcePropType,
    wave: require('../../../assets/fur/pushy-wave.webp') as ImageSourcePropType,
  },
  ring: require('../../../assets/fur/ring.webp') as ImageSourcePropType,
  flame: require('../../../assets/fur/flame.webp') as ImageSourcePropType,
  pill: require('../../../assets/fur/pill.webp') as ImageSourcePropType,
  trophy: require('../../../assets/fur/trophy.webp') as ImageSourcePropType,
  heart: require('../../../assets/fur/heart.webp') as ImageSourcePropType,
  home: require('../../../assets/fur/home.webp') as ImageSourcePropType,
  shoe: require('../../../assets/fur/shoe.webp') as ImageSourcePropType,
  arrow: require('../../../assets/fur/arrow.webp') as ImageSourcePropType,
};

export type FurUnit = keyof typeof furImages.units;
export type PushyPose = keyof typeof furImages.pushy;

/** Width divided by height of the images, so a row can be laid out without measuring. */
export const furAspect = {
  digits: [203, 170, 189, 183, 218, 181, 188, 187, 183, 181].map((width) => width / 256),
  comma: 191 / 256,
  units: { km: 412 / 256, kmh: 666 / 256, schritte: 1124 / 256 },
} as const;

/** Every image once, so that a screen never waits for one to decode. */
export const allFurSources: ImageSourcePropType[] = [
  ...furImages.digits,
  furImages.comma,
  ...Object.values(furImages.units),
  furImages.push,
  ...Object.values(furImages.pushy),
  furImages.ring,
  furImages.flame,
  furImages.pill,
  furImages.trophy,
  furImages.heart,
  furImages.home,
  furImages.shoe,
];
