const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const VIEW_PERMISSION_USAGE_ACTION = 'android.intent.action.VIEW_PERMISSION_USAGE';
const VIEW_PERMISSION_USAGE_ALIAS = 'ViewPermissionUsageActivity';
const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

function hasAction(intentFilter, actionName) {
  return (intentFilter.action ?? []).some((action) => action.$['android:name'] === actionName);
}

function withHealthConnectPrivacyManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(modConfig.modResults);
    const privacyActivityName = '.HealthConnectPrivacyActivity';

    mainActivity['intent-filter'] = (mainActivity['intent-filter'] ?? []).filter(
      (intentFilter) => !hasAction(intentFilter, RATIONALE_ACTION),
    );

    application.activity = (application.activity ?? []).filter(
      (activity) => activity.$['android:name'] !== privacyActivityName,
    );
    application.activity.push({
      $: {
        'android:name': privacyActivityName,
        'android:exported': 'true',
        'android:label': 'Datenschutz bei PUSH',
        'android:theme': '@android:style/Theme.Material.Light.NoActionBar',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': RATIONALE_ACTION } }],
        },
      ],
    });

    application['activity-alias'] = (application['activity-alias'] ?? []).filter(
      (activityAlias) => activityAlias.$['android:name'] !== VIEW_PERMISSION_USAGE_ALIAS,
    );
    application['activity-alias'].push({
      $: {
        'android:name': VIEW_PERMISSION_USAGE_ALIAS,
        'android:exported': 'true',
        'android:targetActivity': privacyActivityName,
        'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        'android:label': 'Datenschutz bei PUSH',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': VIEW_PERMISSION_USAGE_ACTION } }],
          category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
        },
      ],
    });

    const queries = manifest.queries ?? (manifest.queries = []);
    const alreadyDeclared = queries.some((query) =>
      (query.package ?? []).some(
        (pkg) => pkg.$['android:name'] === HEALTH_CONNECT_PACKAGE,
      ),
    );
    if (!alreadyDeclared) {
      queries.push({ package: [{ $: { 'android:name': HEALTH_CONNECT_PACKAGE } }] });
    }

    return modConfig;
  });
}

function withHealthConnectPrivacyActivity(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const appPackage = modConfig.android.package;
      if (!appPackage) {
        throw new Error('Set android.package before generating the Health Connect privacy activity.');
      }

      const packagePath = appPackage.replaceAll('.', path.sep);
      const sourcePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'HealthConnectPrivacyActivity.kt',
      );
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(
        sourcePath,
        `package ${appPackage}

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class HealthConnectPrivacyActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.rgb(10, 10, 10)
    window.navigationBarColor = Color.rgb(10, 10, 10)

    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(48, 64, 48, 32)
      setBackgroundColor(Color.rgb(10, 10, 10))
    }

    content.addView(textView("Datenschutz bei PUSH", 26f, Color.WHITE, true))
    content.addView(textView(
      "PUSH liest aus Health Connect ausschließlich Lauf-Sessions, die dazugehörige Distanz und Tagesschritte. Die Daten werden synchronisiert und zur Prüfung deines Challenge-Fortschritts verwendet. PUSH schreibt keine Gesundheitsdaten in Health Connect.",
      16f,
      Color.LTGRAY,
    ))
    content.addView(textView(
      "Manuelle Lauf-Einträge zählen nicht. Enthält eine Datenquelle an einem Tag manuelle Schritte, wird diese Quelle für den ganzen Tag ausgeschlossen. Dadurch können auch echte Schritte dieser Quelle fehlen und dein angezeigter Fortschritt niedriger ausfallen.",
      16f,
      Color.LTGRAY,
    ))
    content.addView(textView(
      "Es werden nur Daten der letzten 45 Tage gelesen. Deine Gesundheitsdaten werden nicht anderen Teilnehmenden angezeigt.",
      16f,
      Color.LTGRAY,
    ))

    val closeButton = textView("Schließen", 16f, Color.rgb(198, 255, 0), true).apply {
      gravity = Gravity.CENTER
      isClickable = true
      isFocusable = true
      setPadding(24, 28, 24, 28)
      setOnClickListener { finish() }
    }
    content.addView(closeButton)

    setContentView(ScrollView(this).apply { addView(content) })
  }

  private fun textView(value: String, size: Float, color: Int, bold: Boolean = false) =
    TextView(this).apply {
      text = value
      textSize = size
      setTextColor(color)
      if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, 0, 0, 28)
    }
}
`,
      );

      return modConfig;
    },
  ]);
}

module.exports = function withHealthConnectPrivacy(config) {
  config = withHealthConnectPrivacyManifest(config);
  return withHealthConnectPrivacyActivity(config);
};
