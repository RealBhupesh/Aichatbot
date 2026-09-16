const TOOL_LABELS: Record<string, string> = {
  checkAvailability: "Checking room availability",
  prepareBookingHold: "Sending this to the front desk",
  getHotelInfo: "Looking up hotel details",
  getRoomDetails: "Checking room details",
  getPolicy: "Checking hotel policy",
  getAmenityInfo: "Checking amenities",
  searchFaqs: "Searching the desk notes",
  escalateToStaff: "Connecting you with the team",
};

export function toolStatusLabel(toolName: string) {
  return TOOL_LABELS[toolName] ?? "Leela is working on that";
}
