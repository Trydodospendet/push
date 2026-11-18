const { withProjectBuildGradle } = require('@expo/config-plugins');

// @stripe/stripe-react-native 0.81 declares stripe-android-issuing-push-provisioning (compileOnly),
// which pulls com.google.android.gms:play-services-tapandpay. That artifact is not published in any
// public Maven repository, so the EAS build fails. PUSH does not use card push provisioning,
// so the transitive dependency is excluded and lint-vital is skipped for release builds.
const MARKER = '// push: stripe without tapandpay';

const SNIPPET = `
${MARKER}
allprojects {
  configurations.configureEach {
    exclude group: 'com.google.android.gms', module: 'play-services-tapandpay'
  }
}
subprojects { sub ->
  sub.plugins.withId('com.android.library') {
    if (sub.name == 'stripe_stripe-react-native') {
      sub.android.lint.checkReleaseBuilds = false
      sub.android.lint.abortOnError = false
    }
  }
}
`;

module.exports = function withStripeNoTapAndPay(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
