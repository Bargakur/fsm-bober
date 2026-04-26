import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/order.dart';
import '../models/technician.dart';

class ApiService {
  // Dla emulatora Android: 10.0.2.2
  // Dla symulatora iOS: localhost
  // Dla prawdziwego urządzenia: IP komputera w sieci
  static String baseUrl = 'http://localhost:5050/api';
  static String? _token;

  static void setBaseUrl(String url) {
    baseUrl = url;
  }

  /// Odczytaj zapisany token przy starcie aplikacji
  static Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
  }

  /// Zaloguj technika PINem i zapisz token
  static Future<Map<String, dynamic>> technicianLogin(
      int technicianId, String pin) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/technician-login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'technicianId': technicianId, 'pin': pin}),
    );
    if (res.statusCode != 200) throw Exception('Nieprawidłowy PIN');
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    _token = data['token'] as String;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', _token!);
    return data;
  }

  static Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }

  static Map<String, String> get _authHeaders => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  static Future<List<Technician>> getTechnicians() async {
    final res = await http.get(Uri.parse('$baseUrl/technicians'));
    if (res.statusCode != 200) throw Exception('Błąd pobierania techników');
    final list = jsonDecode(res.body) as List;
    return list.map((j) => Technician.fromJson(j)).toList();
  }

  static Future<List<Order>> getTechnicianOrders(
      int technicianId, String date) async {
    final res = await http.get(
      Uri.parse('$baseUrl/orders/technician/$technicianId?date=$date'),
      headers: _authHeaders,
    );
    if (res.statusCode == 401) throw Exception('Sesja wygasła. Zaloguj się ponownie.');
    if (res.statusCode != 200) throw Exception('Błąd pobierania zleceń');
    final list = jsonDecode(res.body) as List;
    return list.map((j) => Order.fromJson(j)).toList();
  }

  static Future<void> completeOrder(int orderId,
      {String? paymentOverride, String? technicianNotes}) async {
    final res = await http.put(
      Uri.parse('$baseUrl/orders/$orderId/complete'),
      headers: _authHeaders,
      body: jsonEncode({
        if (paymentOverride != null) 'paymentOverride': paymentOverride,
        if (technicianNotes != null) 'technicianNotes': technicianNotes,
      }),
    );
    if (res.statusCode == 401) throw Exception('Sesja wygasła. Zaloguj się ponownie.');
    if (res.statusCode != 200) throw Exception('Błąd zamykania zlecenia');
  }

  static Future<void> reportLocation(
      int technicianId, double lat, double lng) async {
    await http.post(
      Uri.parse('$baseUrl/orders/technician/$technicianId/location'),
      headers: _authHeaders,
      body: jsonEncode({'lat': lat, 'lng': lng}),
    );
  }
}
