<?php
/**
 * REST proxy for the Ruhratna AI Stylist.
 * Exposes /wp-json/ruhratna-stylist/v1/{analyse, match, result/<job_id>}.
 *
 * /analyse runs the uploaded image through TinyPNG first, then forwards
 *   the compressed image to Railway and returns the analysis synchronously.
 * /match  forwards the analysis to Railway, which kicks off an async job
 *   and immediately returns { job_id }.
 * /result/<job_id> polls Railway for that job. Railway returns either
 *   { status: "running" }, { status: "done", result: {...} }, or
 *   { status: "error", ... }.
 */

defined('ABSPATH') or exit;

define('RUHRATNA_SKIP_TINIFY', true);

/* ---- Hardcoded credentials (replace TinyPNG key before deploying) ---- */
const RUHRATNA_TINIFY_KEY  = '91Y80DhGqSqpLDzHqQLm3h3PTdCHB3mH';
const RUHRATNA_RAILWAY_URL = 'https://web-production-8b1fc.up.railway.app';

const RUHRATNA_TINIFY_SHRINK_ENDPOINT = 'https://api.tinify.com/shrink';

add_action('rest_api_init', 'ruhratna_ais_register_routes');
function ruhratna_ais_register_routes() {
    register_rest_route('ruhratna-stylist/v1', '/analyse', [
        'methods'             => 'POST',
        'callback'            => 'ruhratna_ais_proxy_analyse',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('ruhratna-stylist/v1', '/match', [
        'methods'             => 'POST',
        'callback'            => 'ruhratna_ais_proxy_match',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('ruhratna-stylist/v1', '/result/(?P<job_id>[a-zA-Z0-9-]+)', [
        'methods'             => 'GET',
        'callback'            => 'ruhratna_ais_proxy_result',
        'permission_callback' => '__return_true',
        'args'                => [
            'job_id' => [
                'validate_callback' => function ($v) { return is_string($v) && $v !== ''; },
            ],
        ],
    ]);
}

/* -----------------------------------------------------------
 * POST /analyse
 * Body: { image: <base64>, occasion: <string> }
 * Flow: base64 → TinyPNG compress → re-base64 → Railway /analyse
 * --------------------------------------------------------- */
function ruhratna_ais_proxy_analyse(WP_REST_Request $request) {
    $params = $request->get_json_params();
    if (empty($params['image']) || empty($params['occasion'])) {
        return new WP_Error(
            'missing_params',
            'image and occasion are required',
            ['status' => 400]
        );
    }

    $binary = base64_decode($params['image'], true);
    if ($binary === false || strlen($binary) === 0) {
        return new WP_Error(
            'invalid_image',
            'image field is not valid base64',
            ['status' => 400]
        );
    }

    if (defined('RUHRATNA_SKIP_TINIFY') && RUHRATNA_SKIP_TINIFY) {
        $compressed = $binary;
    } else {
        $compressed = ruhratna_ais_tinify_compress($binary);
        if (is_wp_error($compressed)) {
            return $compressed;
        }
    }

    return ruhratna_ais_forward_to_railway('/analyse', [
        'image'    => base64_encode($compressed),
        'occasion' => $params['occasion'],
    ]);
}

/* -----------------------------------------------------------
 * POST /match — kicks off the async match job on Railway.
 * Railway returns { job_id } immediately; we pass it through.
 * The frontend then polls /result/<job_id> until status is
 * "done" or "error".
 * --------------------------------------------------------- */
function ruhratna_ais_proxy_match(WP_REST_Request $request) {
    $params = $request->get_json_params();
    return ruhratna_ais_forward_to_railway('/match', $params);
}

/* -----------------------------------------------------------
 * GET /result/<job_id> — polls Railway for the match job.
 * Railway returns one of:
 *   { status: "running" }
 *   { status: "done",  result: { stylist_reading, recommendations, ... } }
 *   { status: "error", message: "..." }
 * --------------------------------------------------------- */
function ruhratna_ais_proxy_result(WP_REST_Request $request) {
    $job_id = (string) $request['job_id'];

    $res = wp_remote_get(RUHRATNA_RAILWAY_URL . '/result/' . rawurlencode($job_id), [
        'timeout' => 30,
    ]);
    if (is_wp_error($res)) {
        return new WP_Error(
            'railway_request_failed',
            'Railway result poll failed: ' . $res->get_error_message(),
            ['status' => 502]
        );
    }

    $code = (int) wp_remote_retrieve_response_code($res);
    $body = wp_remote_retrieve_body($res);
    $data = json_decode($body, true);

    if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
        return new WP_Error(
            'railway_invalid_json',
            'Railway returned non-JSON body',
            ['status' => 502, 'raw' => $body]
        );
    }

    return new WP_REST_Response($data, $code);
}

/* -----------------------------------------------------------
 * TinyPNG: POST raw image bytes → follow Location → return
 * compressed image bytes. Returns WP_Error on failure.
 * --------------------------------------------------------- */
function ruhratna_ais_tinify_compress($binary) {
    $auth = 'Basic ' . base64_encode('api:' . RUHRATNA_TINIFY_KEY);

    $shrink = wp_remote_post(RUHRATNA_TINIFY_SHRINK_ENDPOINT, [
        'headers' => [
            'Authorization' => $auth,
            'Content-Type'  => 'application/octet-stream',
        ],
        'body'    => $binary,
        'timeout' => 30,
    ]);
    if (is_wp_error($shrink)) {
        return new WP_Error(
            'tinify_request_failed',
            'TinyPNG request failed: ' . $shrink->get_error_message(),
            ['status' => 502]
        );
    }

    $code = (int) wp_remote_retrieve_response_code($shrink);
    if ($code < 200 || $code >= 300) {
        return new WP_Error(
            'tinify_bad_status',
            'TinyPNG returned status ' . $code,
            ['status' => 502, 'body' => wp_remote_retrieve_body($shrink)]
        );
    }

    $location = wp_remote_retrieve_header($shrink, 'location');
    if (empty($location)) {
        return new WP_Error(
            'tinify_no_location',
            'TinyPNG did not return a Location header',
            ['status' => 502]
        );
    }

    $download = wp_remote_get($location, [
        'headers' => ['Authorization' => $auth],
        'timeout' => 30,
    ]);
    if (is_wp_error($download)) {
        return new WP_Error(
            'tinify_download_failed',
            'TinyPNG download failed: ' . $download->get_error_message(),
            ['status' => 502]
        );
    }

    $body = wp_remote_retrieve_body($download);
    if (strlen($body) === 0) {
        return new WP_Error(
            'tinify_empty_body',
            'TinyPNG returned an empty compressed image',
            ['status' => 502]
        );
    }

    return $body;
}

/* -----------------------------------------------------------
 * Forward a JSON body to Railway and return its response
 * verbatim (passing through the upstream status code).
 * --------------------------------------------------------- */
function ruhratna_ais_forward_to_railway($path, $payload) {
    $res = wp_remote_post(RUHRATNA_RAILWAY_URL . $path, [
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode($payload),
        'timeout' => 60,
    ]);
    if (is_wp_error($res)) {
        return new WP_Error(
            'railway_request_failed',
            'Railway request failed: ' . $res->get_error_message(),
            ['status' => 502]
        );
    }

    $code = (int) wp_remote_retrieve_response_code($res);
    $body = wp_remote_retrieve_body($res);
    $data = json_decode($body, true);

    if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
        return new WP_Error(
            'railway_invalid_json',
            'Railway returned non-JSON body',
            ['status' => 502, 'raw' => $body]
        );
    }

    return new WP_REST_Response($data, $code);
}
