/**
 * GSAP (iOS/Android): core + eases + @gsap/react.
 * Plugins que dependen del DOM (ScrollTrigger, Flip, etc.) están en registerGsapPlugins.web.js
 */
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { CustomEase } from 'gsap/CustomEase';
import { RoughEase, SlowMo, ExpoScaleEase } from 'gsap/EasePack';

gsap.registerPlugin(
  useGSAP,
  CustomEase,
  RoughEase,
  SlowMo,
  ExpoScaleEase
);

export { gsap, useGSAP };
