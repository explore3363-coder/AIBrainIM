import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C, TYPO, LAYOUT} from '../data/constants';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({onLogin}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('请输入邮箱和密码', '', [{text: '好的'}]);
      return;
    }
    // Save auth token to keychain on successful login
    try {
      const Keychain = require('react-native-keychain').default || require('react-native-keychain');
      await Keychain.setGenericPassword('auth_token', email.trim(), {
        service: 'AIBrainIM.AuthToken',
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch { /* ignore keychain errors */ }
    onLogin();
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}>

          {/* Header: Logo + Live tag */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoIconText}>⬡</Text>
              </View>
              <View>
                <Text style={styles.title}>AI Brain</Text>
                <Text style={styles.subtitle}>工业智能操作系统</Text>
                <Text style={styles.subtitleEn}>Industrial Intelligence OS</Text>
              </View>
            </View>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>实时 / LIVE</Text>
            </View>
          </View>

          {/* Mission statement */}
          <Text style={styles.mission}>把目标变成可执行任务</Text>
          <Text style={styles.missionEn}>Turn goals into executable work</Text>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>登录 / Sign In</Text>

            {/* Email input */}
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>✉</Text>
              <TextInput
                style={styles.input}
                placeholder="邮箱 / Email"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password input */}
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="密码 / Password"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secure}
              />
              <TouchableOpacity onPress={() => setSecure(!secure)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{secure ? '👁' : '👁🗨'}</Text>
              </TouchableOpacity>
            </View>

            {/* Remember + Forgot */}
            <View style={styles.helperRow}>
              <TouchableOpacity style={styles.checkRow}>
                <View style={styles.checkbox} />
                <Text style={styles.checkLabel}>记住我 / Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.forgotLink}>忘记密码？</Text>
              </TouchableOpacity>
            </View>

            {/* Primary CTA */}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
              <Text style={styles.primaryBtnText}>登录 / Sign In</Text>
              <Text style={styles.primaryBtnArrow}>→</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>或 / Or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SSO buttons */}
            <TouchableOpacity style={styles.ssoBtn} onPress={handleLogin}>
              <Text style={styles.ssoBtnIcon}>🏢</Text>
              <Text style={styles.ssoBtnText}>SSO 登录 / SSO Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ssoBtn} onPress={handleLogin}>
              <Text style={styles.ssoBtnIcon}>🍎</Text>
              <Text style={styles.ssoBtnText}>Apple 登录 / Sign in with Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ssoBtn} onPress={handleLogin}>
              <Text style={styles.ssoBtnIcon}>🏛</Text>
              <Text style={styles.ssoBtnText}>企业账号 / Enterprise SSO</Text>
            </TouchableOpacity>
          </View>

          {/* Feature icons */}
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📡</Text>
              <Text style={styles.featureLabel}>实时</Text>
              <Text style={styles.featureLabelEn}>Real-time</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🛡</Text>
              <Text style={styles.featureLabel}>安全</Text>
              <Text style={styles.featureLabelEn}>Secure</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⬡</Text>
              <Text style={styles.featureLabel}>多 Agent</Text>
              <Text style={styles.featureLabelEn}>Multi-agent</Text>
            </View>
          </View>

          {/* Trust badge */}
          <View style={styles.trustBadge}>
            <Text style={styles.trustIcon}>🛡</Text>
            <Text style={styles.trustText}>工业级安全保障 / Enterprise-grade Security</Text>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: C.bgRoot,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.pageMargin,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIconText: {
    fontSize: 22,
    color: C.primary,
  },
  title: {
    ...TYPO.h1,
    color: C.textPrimary,
  },
  subtitle: {
    ...TYPO.bodySm,
    color: C.textSecondary,
  },
  subtitleEn: {
    ...TYPO.caption,
    color: C.textMuted,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.bgCard,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
  },
  liveText: {
    ...TYPO.micro,
    color: C.primary,
  },
  mission: {
    ...TYPO.h2,
    color: C.textPrimary,
    marginBottom: 2,
  },
  missionEn: {
    ...TYPO.bodySm,
    color: C.textMuted,
    marginBottom: 32,
  },
  card: {
    backgroundColor: C.bgGlass,
    borderRadius: LAYOUT.cardRadius,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: LAYOUT.cardPadding,
    marginBottom: 24,
  },
  cardTitle: {
    ...TYPO.h2,
    color: C.textPrimary,
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgSurface,
    borderRadius: LAYOUT.cardRadiusSm,
    borderWidth: 1,
    borderColor: C.borderDefault,
    paddingHorizontal: 14,
    marginBottom: 12,
    height: 50,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    ...TYPO.body,
    color: C.textPrimary,
  },
  eyeBtn: {
    padding: 4,
  },
  eyeText: {
    fontSize: 16,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  checkLabel: {
    ...TYPO.bodySm,
    color: C.textSecondary,
  },
  forgotLink: {
    ...TYPO.bodySm,
    color: C.primary,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: LAYOUT.cardRadiusSm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
    marginBottom: 20,
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  primaryBtnText: {
    ...TYPO.h3,
    color: '#080A0F',
    fontWeight: '700',
  },
  primaryBtnArrow: {
    fontSize: 18,
    color: '#080A0F',
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.borderDefault,
  },
  dividerText: {
    ...TYPO.caption,
    color: C.textMuted,
  },
  ssoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bgSurface,
    borderRadius: LAYOUT.cardRadiusSm,
    borderWidth: 1,
    borderColor: C.borderDefault,
    height: 46,
    marginBottom: 10,
    gap: 8,
  },
  ssoBtnIcon: {
    fontSize: 18,
  },
  ssoBtnText: {
    ...TYPO.body,
    color: C.textPrimary,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  featureItem: {
    alignItems: 'center',
    gap: 4,
  },
  featureIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  featureLabel: {
    ...TYPO.bodySm,
    color: C.textPrimary,
  },
  featureLabelEn: {
    ...TYPO.caption,
    color: C.textMuted,
  },
  trustBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  trustIcon: {
    fontSize: 14,
  },
  trustText: {
    ...TYPO.caption,
    color: C.textMuted,
  },
});
