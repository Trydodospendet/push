import { render, screen } from '@testing-library/react-native';

import { ElevationProfile, PaceChart, PeriodChart, SplitsTable } from './charts';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));

const splits = [
  { km: 1, distanceM: 1000, seconds: 335, paceSPerKm: 335, ascentM: 12 },
  { km: 2, distanceM: 1000, seconds: 320, paceSPerKm: 320, ascentM: 3 },
  { km: 3, distanceM: 600, seconds: 190, paceSPerKm: 317, ascentM: 0 },
];

describe('SplitsTable', () => {
  it('lists every kilometre with its pace and the rest with its length', async () => {
    await render(<SplitsTable splits={splits} />);
    expect(screen.getByLabelText('Kilometer 1: 5:35 pro Kilometer')).toBeOnTheScreen();
    expect(screen.getByLabelText('Kilometer 2: 5:20 pro Kilometer')).toBeOnTheScreen();
    expect(screen.getByLabelText('Kilometer 0,60 km: 5:17 pro Kilometer')).toBeOnTheScreen();
  });

  it('says so when the run was shorter than a kilometre', async () => {
    await render(<SplitsTable splits={[]} />);
    expect(screen.getByText(/Noch keine volle Kilometer-Zeit/)).toBeOnTheScreen();
  });
});

describe('profile charts', () => {
  const points = [
    { distanceM: 100, altitudeM: 100, paceSPerKm: 330 },
    { distanceM: 200, altitudeM: 112, paceSPerKm: 340 },
    { distanceM: 300, altitudeM: 108, paceSPerKm: 320 },
  ];

  it('describe the elevation and the pace range for screen readers', async () => {
    await render(
      <>
        <ElevationProfile points={points} />
        <PaceChart points={points} />
      </>,
    );
    expect(screen.getByLabelText('Höhenprofil von 100 bis 112 Metern')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tempo zwischen 5:20 und 5:40 pro Kilometer')).toBeOnTheScreen();
  });

  it('draw nothing without altitude data', async () => {
    await render(
      <ElevationProfile points={points.map((point) => ({ ...point, altitudeM: null }))} />,
    );
    expect(screen.queryByText('HÖHENPROFIL')).toBeNull();
  });
});

describe('PeriodChart', () => {
  it('sums the weeks for the screen reader', async () => {
    await render(
      <PeriodChart
        unit="week"
        stats={[
          { periodStart: '2026-11-02', distanceM: 12000, runs: 2, durationS: 4000 },
          { periodStart: '2026-11-09', distanceM: 8000, runs: 1, durationS: 2600 },
        ]}
      />,
    );
    expect(
      screen.getByLabelText('Die letzten Wochen: 20,00 Kilometer in 3 Läufen'),
    ).toBeOnTheScreen();
    expect(screen.getByText('20,00 km in 3 Läufen')).toBeOnTheScreen();
  });
});
