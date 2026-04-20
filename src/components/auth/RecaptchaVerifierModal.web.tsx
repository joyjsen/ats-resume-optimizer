import React, { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

export interface RecaptchaVerifierRef {
  verify: () => Promise<string>;
}

// Dummy Modal for Web (Web ReCAPTCHA is handled by Firebase JS SDK directly using RecaptchaVerifier)
const RecaptchaVerifierModal = forwardRef<RecaptchaVerifierRef, any>((props, ref) => {
  useImperativeHandle(ref, () => ({
    verify: () => {
      console.warn('RecaptchaVerifierModal is a stub on web. The web uses Firebase\'s native ReCAPTCHA integration.');
      return Promise.reject(new Error('Use web-native RecaptchaVerifier on web.'));
    },
    _reset: () => {}
  }));

  return null;
});

export default RecaptchaVerifierModal;
