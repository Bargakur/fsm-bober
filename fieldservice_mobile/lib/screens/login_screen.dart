import 'package:flutter/material.dart';
import '../models/technician.dart';
import '../services/api_service.dart';
import 'day_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  List<Technician> _technicians = [];
  bool _loading = true;
  String? _error;
  final _urlController = TextEditingController(text: ApiService.baseUrl);

  @override
  void initState() {
    super.initState();
    _loadTechnicians();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _loadTechnicians() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final techs = await ApiService.getTechnicians();
      setState(() {
        _technicians = techs;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Nie można połączyć z serwerem.\nSprawdź adres API.';
        _loading = false;
      });
    }
  }

  void _updateUrl() {
    ApiService.setBaseUrl(_urlController.text.trim());
    _loadTechnicians();
  }

  void _selectTechnician(Technician tech) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => DayScreen(
          technicianId: tech.id,
          technicianName: tech.fullName,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A1E),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 60),
              // Logo
              const Icon(Icons.engineering, color: Color(0xFFC8712E), size: 56),
              const SizedBox(height: 12),
              const Text(
                'FieldService',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Aplikacja technika',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 15),
              ),
              const SizedBox(height: 40),

              // URL serwera
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _urlController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: 'Adres API',
                        labelStyle: TextStyle(color: Colors.grey.shade500),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: Colors.grey.shade700),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: Colors.grey.shade700),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _updateUrl,
                    icon: const Icon(Icons.refresh, color: Colors.white70),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              // Lista techników lub błąd
              if (_loading)
                const CircularProgressIndicator(color: Color(0xFFC8712E))
              else if (_error != null)
                Column(
                  children: [
                    Icon(Icons.wifi_off, color: Colors.red.shade400, size: 40),
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.red.shade300, fontSize: 14),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _updateUrl,
                      child: const Text('Spróbuj ponownie'),
                    ),
                  ],
                )
              else ...[
                Text(
                  'Wybierz technika:',
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: ListView.separated(
                    itemCount: _technicians.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final tech = _technicians[index];
                      return Material(
                        color: Colors.white.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _selectTechnician(tech),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: const Color(0xFFC8712E),
                                  radius: 20,
                                  child: Text(
                                    tech.fullName.split(' ').map((w) => w[0]).take(2).join(),
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      tech.fullName,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      tech.phone,
                                      style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                                    ),
                                  ],
                                ),
                                const Spacer(),
                                Icon(Icons.chevron_right, color: Colors.grey.shade600),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
