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
    schritte: require('../../../assets/fur/schritte.webp') as ImageSourcePropType,
  },
  pushy: {
    sit: require('../../../assets/fur/pushy-sit.webp') as ImageSourcePropType,
    run: require('../../../assets/fur/pushy-run.webp') as ImageSourcePropType,
    cheer: require('../../../assets/fur/pushy-cheer.webp') as ImageSourcePropType,
    dizzy: require('../../../assets/fur/pushy-dizzy.webp') as ImageSourcePropType,
    sad: require('../../../assets/fur/pushy-sad.webp') as ImageSourcePropType,
    sleep: require('../../../assets/fur/pushy-sleep.webp') as ImageSourcePropType,
    wave: require('../../../assets/fur/pushy-wave.webp') as ImageSourcePropType,
  },
};

export type FurUnit = keyof typeof furImages.units;
export type PushyPose = keyof typeof furImages.pushy;

/** Width divided by height of the images, so a row can be laid out without measuring. */
export const furAspect = {
  digits: [203, 170, 189, 183, 218, 181, 188, 187, 183, 181].map((width) => width / 256),
  comma: 191 / 256,
  units: { km: 412 / 256, schritte: 1124 / 256 },
} as const;

/** Every image once, so that a screen never waits for one to decode. */
export const allFurSources: ImageSourcePropType[] = [
  ...furImages.digits,
  furImages.comma,
  ...Object.values(furImages.units),
  ...Object.values(furImages.pushy),
];
