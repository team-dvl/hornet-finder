/**
 * Icons of the application, in one place.
 *
 * Map objects keep their emoji (they are the markers' symbols); actions use
 * bootstrap-icons names (without the `bi-` prefix). FontAwesome is not
 * loaded: never use `fa-*` classes.
 */

export const OBJECT_ICONS = {
  hornet: '🐝',
  nest: '🏴',
  apiary: '🍯',
  trap: '🪤',
} as const;

export const ACTION_ICONS = {
  add: 'plus-lg',
  addHere: 'plus-circle',
  edit: 'pencil',
  delete: 'trash',
  archive: 'archive',
  move: 'arrows-move',
  scan: 'qr-code-scan',
  locate: 'crosshair',
  showOnMap: 'geo-alt-fill',
  sheet: 'card-text',
  more: 'three-dots-vertical',
  layers: 'layers',
  compass: 'compass',
  catch: 'bug',
  action: 'clipboard-check',
  save: 'check-lg',
  back: 'arrow-left',
} as const;
