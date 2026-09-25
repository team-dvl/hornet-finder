import { useState } from 'react';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import CoordinateInput from '../common/CoordinateInput';
import { BottomSheet } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';

interface AddItemSelectorProps {
  show: boolean;
  onHide: () => void;
  latitude: number;
  longitude: number;
  onSelectHornet: (lat?: number, lng?: number) => void;
  onSelectApiary: (lat?: number, lng?: number) => void;
  onSelectNest: (lat?: number, lng?: number) => void;
  onSelectTrap: (lat?: number, lng?: number) => void;
}

export default function AddItemSelector({ 
  show, 
  onHide, 
  latitude, 
  longitude, 
  onSelectHornet, 
  onSelectApiary, 
  onSelectNest,
  onSelectTrap
}: AddItemSelectorProps) {
  const { canAddHornet, canAddApiary, canAddTrap, roles, isAdmin } = useUserPermissions();
  
  // État local pour les coordonnées éditables (pour les admins). Mounted
  // anew for each position (keyed by it on the map), so no resync is needed.
  const [editableLat, setEditableLat] = useState(latitude);
  const [editableLng, setEditableLng] = useState(longitude);
  
  // Vérifier si l'utilisateur peut ajouter des nids (pour l'instant, tous les utilisateurs authentifiés)
  const canAddNest = roles.length > 0;


  // Fonctions pour gérer les sélections avec les coordonnées modifiées
  const handleSelectHornet = () => {
    if (isAdmin) {
      onSelectHornet(editableLat, editableLng);
    } else {
      onSelectHornet();
    }
  };

  const handleSelectApiary = () => {
    if (isAdmin) {
      onSelectApiary(editableLat, editableLng);
    } else {
      onSelectApiary();
    }
  };

  const handleSelectNest = () => {
    if (isAdmin) {
      onSelectNest(editableLat, editableLng);
    } else {
      onSelectNest();
    }
  };

  const handleSelectTrap = () => {
    if (isAdmin) {
      onSelectTrap(editableLat, editableLng);
    } else {
      onSelectTrap();
    }
  };

  const choices = [
    { allowed: canAddHornet, icon: OBJECT_ICONS.hornet, label: 'Frelon', hint: "Signaler l'observation d'un frelon et sa direction de vol", onClick: handleSelectHornet },
    { allowed: canAddNest, icon: OBJECT_ICONS.nest, label: 'Nid', hint: 'Signaler un nid de frelons asiatiques', onClick: handleSelectNest },
    { allowed: canAddApiary, icon: OBJECT_ICONS.apiary, label: 'Rucher', hint: "Enregistrer un rucher et son niveau d'infestation", onClick: handleSelectApiary },
    { allowed: canAddTrap, icon: OBJECT_ICONS.trap, label: 'Piège', hint: 'Installer un piège et suivre ses captures', onClick: handleSelectTrap },
  ].filter((choice) => choice.allowed);

  return (
    <BottomSheet show={show} onHide={onHide} title="Ajouter ici">
      {choices.length > 0 ? (
        <div className="choice-grid">
          {choices.map((choice) => (
            <button key={choice.label} type="button" className="choice-tile" onClick={choice.onClick} title={choice.hint}>
              <span className="choice-tile-icon" aria-hidden="true">{choice.icon}</span>
              <span>{choice.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-muted mb-0">
          <i className="bi bi-lock me-2" aria-hidden="true" />
          Votre compte ne permet pas d'ajouter des éléments sur la carte.
        </p>
      )}

      {/* Administrators may correct the position before choosing */}
      {isAdmin && choices.length > 0 && (
        <details className="mt-3 small">
          <summary className="text-muted py-1">
            Ajuster la position : {editableLat.toFixed(5)}, {editableLng.toFixed(5)}
          </summary>
          <div className="d-flex flex-column gap-2 mt-2">
            <CoordinateInput label="Latitude" value={editableLat} onChange={setEditableLat} precision={6} labelPosition="horizontal" />
            <CoordinateInput label="Longitude" value={editableLng} onChange={setEditableLng} precision={6} labelPosition="horizontal" />
          </div>
        </details>
      )}
    </BottomSheet>
  );
}
