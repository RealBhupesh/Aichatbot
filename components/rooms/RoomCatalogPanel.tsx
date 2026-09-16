"use client";

import { RoomBrowseCard } from "@/components/rooms/RoomBrowseCard";
import { formatInr } from "@/lib/hotel";
import type { AvailableRoom } from "@/lib/schemas";

type Props = {
  rooms: AvailableRoom[];
  onOpenRoom: (room: AvailableRoom) => void;
};

export function RoomCatalogPanel({ rooms, onOpenRoom }: Props) {
  if (rooms.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="room-catalog">
      <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100 shadow-sm">
        <table className="table table-zebra table-sm">
          <thead>
            <tr className="bg-base-200 text-xs uppercase tracking-[0.08em] text-base-content/70">
              <th>Room</th>
              <th>Sleeps</th>
              <th>Per night</th>
              <th>Breakfast</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="hover:bg-base-200/50">
                <td className="font-medium text-base-content">{room.name}</td>
                <td>{room.maxGuests}</td>
                <td className="font-semibold text-primary">{formatInr(room.pricePerNight)}</td>
                <td>
                  <span
                    className={`badge badge-sm ${
                      room.breakfastIncluded ? "badge-success" : "badge-ghost"
                    }`}
                  >
                    {room.breakfastIncluded ? "Included" : "Add-on"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3" data-testid="room-results">
        {rooms.map((room) => (
          <RoomBrowseCard
            key={room.id}
            room={room}
            nights={room.nights}
            onOpen={() => onOpenRoom(room)}
          />
        ))}
      </div>
    </div>
  );
}
