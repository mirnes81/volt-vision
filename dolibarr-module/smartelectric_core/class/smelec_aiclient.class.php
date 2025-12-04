<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * Client IA pour génération de contenu
 */

/**
 * Class SmelecAiClient
 * Client pour appels API IA externe
 */
class SmelecAiClient
{
    private $db;
    private $enabled;
    private $apiUrl;
    private $apiKey;

    /**
     * Constructor
     * @param DoliDB $db Database handler
     */
    public function __construct($db)
    {
        global $conf;

        $this->db = $db;
        $this->enabled = !empty($conf->global->SMELEC_AI_ENABLED);
        $this->apiUrl = $conf->global->SMELEC_AI_API_URL ?? '';
        $this->apiKey = $conf->global->SMELEC_AI_API_KEY ?? '';
    }

    /**
     * Check if AI is enabled and configured
     * @return bool
     */
    public function isEnabled()
    {
        return $this->enabled && !empty($this->apiUrl) && !empty($this->apiKey);
    }

    /**
     * Generic AI call
     * @param string $purpose Purpose (summary, client_text, diagnostic, suggest_materials)
     * @param string $inputText Input text
     * @param array $extraData Extra data
     * @return string|array Response
     */
    public function callAi($purpose, $inputText, $extraData = array())
    {
        if (!$this->isEnabled()) {
            return 'Fonctionnalités IA non activées. Configurez les paramètres IA dans l\'administration.';
        }

        $systemPrompt = $this->getSystemPrompt($purpose);

        $payload = array(
            'model' => 'gpt-4',
            'messages' => array(
                array('role' => 'system', 'content' => $systemPrompt),
                array('role' => 'user', 'content' => $inputText)
            ),
            'temperature' => 0.7,
            'max_tokens' => 1000
        );

        // Add extra context if provided
        if (!empty($extraData)) {
            $payload['context'] = $extraData;
        }

        $ch = curl_init($this->apiUrl);
        curl_setopt_array($ch, array(
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => array(
                'Content-Type: application/json',
                'Authorization: Bearer '.$this->apiKey
            ),
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => 30
        ));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            return 'Erreur de communication avec l\'API IA (code '.$httpCode.')';
        }

        $data = json_decode($response, true);
        if (isset($data['choices'][0]['message']['content'])) {
            return $data['choices'][0]['message']['content'];
        }

        // Try alternate response formats
        if (isset($data['response'])) {
            return $data['response'];
        }
        if (isset($data['text'])) {
            return $data['text'];
        }

        return 'Réponse IA invalide';
    }

    /**
     * Get system prompt based on purpose
     * @param string $purpose
     * @return string
     */
    private function getSystemPrompt($purpose)
    {
        $prompts = array(
            'summary' => "Tu es un assistant pour électriciens en Suisse. Génère un résumé technique et professionnel de l'intervention décrite. Inclus les points clés: type de travaux, matériel utilisé, temps passé, et résultat. Sois concis mais complet. Réponds en français.",

            'client_text' => "Tu es un assistant pour électriciens en Suisse. Génère un texte professionnel destiné au client décrivant l'intervention effectuée. Le ton doit être professionnel, rassurant et clair pour un non-technicien. Inclus les travaux réalisés et les recommandations éventuelles. Réponds en français.",

            'diagnostic' => "Tu es un expert électricien en Suisse. Basé sur les symptômes décrits, propose un diagnostic probable et des pistes de résolution. Mentionne les vérifications à effectuer et les risques potentiels. Sois précis et professionnel. Réponds en français.",

            'suggest_materials' => "Tu es un assistant pour électriciens en Suisse. Basé sur le type d'intervention décrit, suggère la liste de matériaux typiquement nécessaires. Donne des quantités estimées. Réponds en JSON avec le format: [{\"ref\": \"...\", \"label\": \"...\", \"qty\": ...}]"
        );

        return $prompts[$purpose] ?? $prompts['summary'];
    }

    /**
     * Generate intervention summary
     * @param SmelecIntervention $intervention
     * @return string
     */
    public function generateSummary($intervention)
    {
        $inputText = $this->buildInterventionContext($intervention);
        $inputText .= "\n\nGénère un résumé technique de cette intervention.";

        return $this->callAi('summary', $inputText);
    }

    /**
     * Generate client-friendly text
     * @param SmelecIntervention $intervention
     * @return string
     */
    public function generateClientText($intervention)
    {
        $inputText = $this->buildInterventionContext($intervention);
        $inputText .= "\n\nGénère un texte professionnel pour le client expliquant les travaux effectués.";

        return $this->callAi('client_text', $inputText);
    }

    /**
     * Generate diagnostic suggestions
     * @param SmelecIntervention $intervention
     * @param string $symptoms User-described symptoms
     * @return string
     */
    public function generateDiagnostic($intervention, $symptoms = '')
    {
        $inputText = "Type d'intervention: ".$intervention->type."\n";
        $inputText .= "Description: ".$intervention->description."\n";
        if ($symptoms) {
            $inputText .= "Symptômes rapportés: ".$symptoms."\n";
        }
        $inputText .= "\nPropose un diagnostic et des pistes de résolution.";

        return $this->callAi('diagnostic', $inputText);
    }

    /**
     * Suggest materials based on intervention type
     * @param string $interventionType
     * @param string $description
     * @return array
     */
    public function suggestMaterials($interventionType, $description)
    {
        $inputText = "Type d'intervention: ".$interventionType."\n";
        $inputText .= "Description: ".$description."\n";
        $inputText .= "\nSuggère la liste de matériaux nécessaires.";

        $response = $this->callAi('suggest_materials', $inputText);

        // Try to parse JSON response
        $materials = json_decode($response, true);
        if (is_array($materials)) {
            return $materials;
        }

        return array();
    }

    /**
     * Build context text from intervention data
     * @param SmelecIntervention $intervention
     * @return string
     */
    private function buildInterventionContext($intervention)
    {
        $text = "=== INTERVENTION ÉLECTRIQUE ===\n";
        $text .= "Référence: ".$intervention->ref."\n";
        $text .= "Type: ".$intervention->type."\n";
        $text .= "Description: ".$intervention->description."\n";

        // Tasks
        if (!empty($intervention->tasks)) {
            $text .= "\n--- TÂCHES ---\n";
            foreach ($intervention->tasks as $task) {
                $status = $task['status'] === 'fait' ? '✓' : '○';
                $text .= $status." ".$task['label']."\n";
            }
        }

        // Materials
        if (!empty($intervention->materials)) {
            $text .= "\n--- MATÉRIAUX UTILISÉS ---\n";
            foreach ($intervention->materials as $mat) {
                $text .= "- ".$mat['qtyUsed']." ".$mat['unit']." ".$mat['productName']."\n";
            }
        }

        // Hours
        if (!empty($intervention->hours)) {
            $totalHours = 0;
            foreach ($intervention->hours as $hour) {
                $totalHours += floatval($hour['durationHours']);
            }
            $text .= "\n--- TEMPS ---\n";
            $text .= "Total: ".number_format($totalHours, 2)." heures\n";
        }

        return $text;
    }
}
