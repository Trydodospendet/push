import { Redirect, useLocalSearchParams } from 'expo-router';

/** push://invite/<friend code>: opens the friends screen with the code filled in. */
export default function InviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/social', params: { code } }} />;
}
