import { useState } from 'react';
import { Circle } from 'react-leaflet';
import { Apiary } from '../../store/slices/apiariesSlice';
import {
  APIARY_CIRCLE_RADIUS_M,
  APIARY_CIRCLE_COLOR,
  APIARY_CIRCLE_FILL_OPACITY_NORMAL,
  APIARY_CIRCLE_BORDER_OPACITY_NORMAL,
  APIARY_CIRCLE_FILL_OPACITY_HIGHLIGHTED,
  APIARY_CIRCLE_BORDER_OPACITY_HIGHLIGHTED
} from '../../utils/constants';

interface ApiaryCircleProps {
  apiary: Apiary;
}

export default function ApiaryCircle({ apiary }: ApiaryCircleProps) {
  const [isHighlighted, setIsHighlighted] = useState(false);

  const handleClick = () => {
    setIsHighlighted(!isHighlighted);
  };

  return (
    <Circle
      center={[apiary.latitude, apiary.longitude]}
      radius={APIARY_CIRCLE_RADIUS_M}
      pathOptions={{
        color: APIARY_CIRCLE_COLOR,
        fillColor: APIARY_CIRCLE_COLOR,
        fillOpacity: isHighlighted ? APIARY_CIRCLE_FILL_OPACITY_HIGHLIGHTED : APIARY_CIRCLE_FILL_OPACITY_NORMAL,
        weight: 2,
        opacity: isHighlighted ? APIARY_CIRCLE_BORDER_OPACITY_HIGHLIGHTED : APIARY_CIRCLE_BORDER_OPACITY_NORMAL,
      }}
      eventHandlers={{
        click: handleClick,
      }}
    />
  );
}
