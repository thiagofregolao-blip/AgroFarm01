import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

type MapPoint = {
  lat: number;
  lng: number;
  title: string;
};

export default function MapView({ points }: { points: MapPoint[] }) {
  const center = points.length > 0 ? [points[0].lat, points[0].lng] as [number, number] : [-25.516, -54.616] as [number, number];

  return (
    <div style={{ height: 400, width: "100%", borderRadius: 8, overflow: "hidden", border: "1px solid #ddd" }}>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {points.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]}>
            <Popup>{p.title}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
