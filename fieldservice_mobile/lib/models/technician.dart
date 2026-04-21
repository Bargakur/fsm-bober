class Technician {
  final int id;
  final String fullName;
  final String phone;
  final String skills;
  final double? homeLat;
  final double? homeLng;

  Technician({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.skills,
    this.homeLat,
    this.homeLng,
  });

  factory Technician.fromJson(Map<String, dynamic> json) {
    return Technician(
      id: json['id'],
      fullName: json['fullName'] ?? '',
      phone: json['phone'] ?? '',
      skills: json['skills'] ?? '',
      homeLat: (json['homeLat'] as num?)?.toDouble(),
      homeLng: (json['homeLng'] as num?)?.toDouble(),
    );
  }
}
