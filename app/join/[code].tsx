import { Redirect, useLocalSearchParams } from 'expo-router';

/** push://join/<invite code>: opens "join with code" with the code filled in. */
export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/challenge/join', params: { code } }} />;
}
