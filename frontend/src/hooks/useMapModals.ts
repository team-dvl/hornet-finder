import { useCallback, useState } from 'react';
import { Hornet } from '../store/slices/hornetsSlice';
import { Apiary } from '../store/slices/apiariesSlice';
import { Nest } from '../store/slices/nestsSlice';
import { Trap } from '../store/slices/trapsSlice';
import { MapObject } from '../components/map/types';

export interface MapPoint {
  lat: number;
  lng: number;
}

/**
 * The map shows one modal at a time: the detail of an object, the "what do you
 * want to add here" selector, one of the creation forms, or the dialog that
 * disambiguates overlapping markers. Modelling that as a single tagged value
 * keeps the state impossible to get wrong (two open dialogs, a stale selection)
 * and makes adding an object type a matter of one more case.
 */
export type MapModal =
  | { kind: 'hornet'; hornet: Hornet; declination: number | null; correctedDirection: number | null }
  | {
      kind: 'returnZone';
      hornet: Hornet;
      position: MapPoint | null;
      declination: number | null;
      correctedDirection: number | null;
    }
  | { kind: 'apiary'; apiary: Apiary }
  | { kind: 'nest'; nest: Nest }
  | { kind: 'trap'; trap: Trap }
  | { kind: 'item-selector'; position: MapPoint }
  | { kind: 'add-hornet'; position: MapPoint; direction: number | null }
  | { kind: 'add-apiary'; position: MapPoint }
  | { kind: 'add-nest'; position: MapPoint }
  /** A trap can also be placed from an address, hence a position that may be missing */
  | { kind: 'add-trap'; position: MapPoint | null }
  | { kind: 'overlap'; objects: MapObject[]; position: MapPoint }
  /** A scanned QR tag not attached to any trap yet */
  | { kind: 'tag-associate'; value: string; short: string }
  | { kind: 'tag-scanner' }
  | null;

export type MapModalKind = NonNullable<MapModal>['kind'];

export function useMapModals() {
  const [modal, setModal] = useState<MapModal>(null);

  const open = useCallback((next: NonNullable<MapModal>) => setModal(next), []);
  const close = useCallback(() => setModal(null), []);

  /** Narrowing helper: returns the modal only when it is of the expected kind. */
  const modalOfKind = useCallback(
    <K extends MapModalKind>(kind: K) =>
      (modal?.kind === kind ? (modal as Extract<NonNullable<MapModal>, { kind: K }>) : null),
    [modal]
  );

  return { modal, open, close, modalOfKind };
}
