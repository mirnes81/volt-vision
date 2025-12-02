<?php
/* Copyright (C) 2024 MV-3 PRO Électricien
 * AI Client for generating summaries, diagnostics, etc.
 */

/**
 * Class Mv3elAiClient
 * Generic AI client for text generation
 */
class Mv3elAiClient
{
    private $db;
    private $enabled;
    private $apiUrl;
    private $apiKey;

    /**
     * Constructor
     *
     * @param DoliDB $db Database handler
     */
    public function __construct($db)
    {
        global $conf;

        $this->db = $db;
        $this->enabled = !empty($conf->global->MV3EL_AI_ENABLED);
        $this->apiUrl = $conf->global->MV3EL_AI_API_URL ?? '';
        $this->apiKey = $conf->global->MV3EL_AI_API_KEY ?? '';
    }

    /**
     * Check if AI is enabled and configured
     *
     * @return bool
     */
    public function isEnabled()
    {
        return $this->enabled && !empty($this->apiUrl) && !empty($this->apiKey);
    }

    /**
     * Generate intervention summary
     *
     * @param Mv3elIntervention $intervention Intervention object
     * @return string Generated summary
     */
    public function generateSummary($intervention)
    {
        if (!$this->isEnabled()) {
            return $this->generateFallbackSummary($intervention);
        }

        $prompt = $this->buildSummaryPrompt($intervention);
        return $this->callApi($prompt, 'summary');
    }

    /**
     * Generate professional client text
     *
     * @param Mv3elIntervention $intervention Intervention object
     * @return string Generated text for client
     */
    public function generateClientText($intervention)
    {
        if (!$this->isEnabled()) {
            return $this->generateFallbackClientText($intervention);
        }

        $prompt = $this->buildClientTextPrompt($intervention);
        return $this->callApi($prompt, 'client_text');
    }

    /**
     * Generate diagnostic based on symptoms
     *
     * @param Mv3elIntervention $intervention Intervention object
     * @param string $symptoms User-described symptoms
     * @return string Generated diagnostic
     */
    public function generateDiagnostic($intervention, $symptoms)
    {
        if (!$this->isEnabled()) {
            return "Diagnostic automatique non disponible. Veuillez activer l'IA dans les paramètres.";
        }

        $prompt = $this->buildDiagnosticPrompt($intervention, $symptoms);
        return $this->callApi($prompt, 'diagnostic');
    }

    /**
     * Suggest materials based on intervention type
     *
     * @param string $interventionType Type of intervention
     * @param string $description Description
     * @return array Suggested materials
     */
    public function suggestMaterials($interventionType, $description)
    {
        if (!$this->isEnabled()) {
            return array();
        }

        $prompt = "Suggérer les matériaux électriques nécessaires pour une intervention de type: $interventionType. Description: $description. Répondre en JSON avec un tableau de {ref, label, qty_suggested}.";
        $response = $this->callApi($prompt, 'materials');

        try {
            return json_decode($response, true) ?? array();
        } catch (Exception $e) {
            return array();
        }
    }

    /**
     * Build summary prompt
     *
     * @param Mv3elIntervention $intervention
     * @return string
     */
    private function buildSummaryPrompt($intervention)
    {
        $tasksCompleted = 0;
        $tasksTotal = count($intervention->tasks);
        foreach ($intervention->tasks as $task) {
            if ($task['status'] === 'fait') {
                $tasksCompleted++;
            }
        }

        $materialsUsed = array();
        foreach ($intervention->materials as $material) {
            $materialsUsed[] = $material['qtyUsed'].' '.$material['unit'].' '.$material['productName'];
        }

        $totalHours = 0;
        foreach ($intervention->hours as $hour) {
            $totalHours += $hour['durationHours'] ?? 0;
        }

        $prompt = "Générer un résumé professionnel et concis (max 200 mots) pour cette intervention électrique:\n";
        $prompt .= "- Type: ".$intervention->intervention_type."\n";
        $prompt .= "- Description: ".$intervention->description."\n";
        $prompt .= "- Tâches: $tasksCompleted/$tasksTotal complétées\n";
        $prompt .= "- Matériaux utilisés: ".implode(', ', $materialsUsed)."\n";
        $prompt .= "- Heures travaillées: ".number_format($totalHours, 1)."h\n";
        $prompt .= "- Photos: ".count($intervention->photos)." prises\n";
        $prompt .= "\nLe résumé doit être en français, professionnel et factuel.";

        return $prompt;
    }

    /**
     * Build client text prompt
     *
     * @param Mv3elIntervention $intervention
     * @return string
     */
    private function buildClientTextPrompt($intervention)
    {
        $prompt = "Rédiger un texte professionnel destiné au client pour cette intervention électrique:\n";
        $prompt .= "- Type: ".$intervention->intervention_type."\n";
        $prompt .= "- Description: ".$intervention->description."\n";
        $prompt .= "- Adresse: ".$intervention->address.", ".$intervention->zip." ".$intervention->town."\n";
        $prompt .= "\nLe texte doit:\n";
        $prompt .= "- Être en français, poli et professionnel\n";
        $prompt .= "- Résumer les travaux effectués\n";
        $prompt .= "- Mentionner les recommandations si pertinent\n";
        $prompt .= "- Faire environ 100-150 mots\n";

        return $prompt;
    }

    /**
     * Build diagnostic prompt
     *
     * @param Mv3elIntervention $intervention
     * @param string $symptoms
     * @return string
     */
    private function buildDiagnosticPrompt($intervention, $symptoms)
    {
        $prompt = "En tant qu'expert électricien, fournir un diagnostic pour:\n";
        $prompt .= "- Type d'intervention: ".$intervention->intervention_type."\n";
        $prompt .= "- Symptômes décrits: $symptoms\n";
        $prompt .= "- Description initiale: ".$intervention->description."\n";
        $prompt .= "\nFournir:\n";
        $prompt .= "1. Causes probables (listées par probabilité)\n";
        $prompt .= "2. Tests à effectuer pour confirmer\n";
        $prompt .= "3. Solutions recommandées\n";
        $prompt .= "4. Avertissements de sécurité si applicable\n";
        $prompt .= "\nRépondre en français de manière structurée.";

        return $prompt;
    }

    /**
     * Call AI API
     *
     * @param string $prompt The prompt
     * @param string $type Type of request (for logging)
     * @return string AI response
     */
    private function callApi($prompt, $type)
    {
        $ch = curl_init();

        // Generic API structure (adapt to your AI provider)
        $postData = json_encode(array(
            'model' => 'gpt-4',  // Or your preferred model
            'messages' => array(
                array(
                    'role' => 'system',
                    'content' => 'Tu es un assistant spécialisé pour une entreprise d\'électricité en Suisse. Tu génères des textes professionnels, concis et précis.'
                ),
                array(
                    'role' => 'user',
                    'content' => $prompt
                )
            ),
            'max_tokens' => 1000,
            'temperature' => 0.7
        ));

        curl_setopt_array($ch, array(
            CURLOPT_URL => $this->apiUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_HTTPHEADER => array(
                'Content-Type: application/json',
                'Authorization: Bearer '.$this->apiKey
            ),
            CURLOPT_TIMEOUT => 30
        ));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            dol_syslog("MV3EL AI API error: HTTP $httpCode - $response", LOG_ERR);
            return "Erreur lors de la génération du contenu.";
        }

        $data = json_decode($response, true);
        return $data['choices'][0]['message']['content'] ?? "Erreur de parsing de la réponse.";
    }

    /**
     * Generate fallback summary when AI is disabled
     *
     * @param Mv3elIntervention $intervention
     * @return string
     */
    private function generateFallbackSummary($intervention)
    {
        $tasksCompleted = 0;
        foreach ($intervention->tasks as $task) {
            if ($task['status'] === 'fait') {
                $tasksCompleted++;
            }
        }
        $tasksTotal = count($intervention->tasks);

        $totalHours = 0;
        foreach ($intervention->hours as $hour) {
            $totalHours += $hour['durationHours'] ?? 0;
        }

        $summary = "Intervention ".$intervention->ref." - ".$this->getTypeLabel($intervention->intervention_type)."\n\n";
        $summary .= "Travaux: ".$intervention->description."\n";
        $summary .= "Tâches: $tasksCompleted/$tasksTotal complétées\n";
        $summary .= "Matériaux: ".count($intervention->materials)." articles utilisés\n";
        $summary .= "Durée: ".number_format($totalHours, 1)."h\n";
        $summary .= "Photos: ".count($intervention->photos)." prises\n";

        return $summary;
    }

    /**
     * Generate fallback client text when AI is disabled
     *
     * @param Mv3elIntervention $intervention
     * @return string
     */
    private function generateFallbackClientText($intervention)
    {
        $text = "Madame, Monsieur,\n\n";
        $text .= "Suite à notre intervention du ".date('d/m/Y')." à l'adresse ";
        $text .= $intervention->address.", ".$intervention->zip." ".$intervention->town.", ";
        $text .= "nous avons le plaisir de vous informer que les travaux ont été effectués avec succès.\n\n";
        $text .= "Nature de l'intervention: ".$this->getTypeLabel($intervention->intervention_type)."\n";
        $text .= "Description: ".$intervention->description."\n\n";
        $text .= "Nous restons à votre disposition pour toute question.\n\n";
        $text .= "Cordialement,\nMV-3 PRO Électricien";

        return $text;
    }

    /**
     * Get type label in French
     *
     * @param string $type
     * @return string
     */
    private function getTypeLabel($type)
    {
        $labels = array(
            'installation' => 'Installation',
            'depannage' => 'Dépannage',
            'renovation' => 'Rénovation',
            'tableau' => 'Tableau électrique',
            'cuisine' => 'Cuisine',
            'oibt' => 'Contrôle OIBT'
        );
        return $labels[$type] ?? $type;
    }
}
