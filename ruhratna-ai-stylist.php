<?php
/**
 * Plugin Name: Ruhratna AI Stylist
 * Description: AI-powered jewellery matching tool. Renders the AI Stylist UI on a dedicated page and proxies /analyse and /match calls to the Railway backend through WordPress REST endpoints (with TinyPNG image compression in between).
 * Version:     1.0.34
 * Author:      Ruhratna
 * License:     GPL-2.0-or-later
 * Text Domain: ruhratna-ai-stylist
 */

defined('ABSPATH') or exit;

define('RUHRATNA_AIS_VERSION',   '1.0.34');
define('RUHRATNA_AIS_DIR',       plugin_dir_path(__FILE__));
define('RUHRATNA_AIS_URL',       plugin_dir_url(__FILE__));
define('RUHRATNA_AIS_PAGE_SLUG', 'ai-stylist');

require_once RUHRATNA_AIS_DIR . 'includes/proxy.php';

/* -----------------------------------------------------------
 * Activation — create the AI Stylist page if missing
 * --------------------------------------------------------- */
register_activation_hook(__FILE__, 'ruhratna_ais_activate');
function ruhratna_ais_activate() {
    $existing = get_page_by_path(RUHRATNA_AIS_PAGE_SLUG);
    if ($existing instanceof WP_Post) {
        return;
    }
    wp_insert_post([
        'post_title'   => 'AI Stylist',
        'post_name'    => RUHRATNA_AIS_PAGE_SLUG,
        'post_status'  => 'publish',
        'post_type'    => 'page',
        'post_content' => '',
        'comment_status' => 'closed',
        'ping_status'    => 'closed',
    ]);
}

/* -----------------------------------------------------------
 * Route the AI Stylist page to the plugin's template file.
 * Theme's header/footer still render around it.
 * --------------------------------------------------------- */
add_filter('template_include', 'ruhratna_ais_template_include');
function ruhratna_ais_template_include($template) {
    if (is_page(RUHRATNA_AIS_PAGE_SLUG)) {
        return RUHRATNA_AIS_DIR . 'templates/ai-stylist.php';
    }
    return $template;
}

/* -----------------------------------------------------------
 * Enqueue stylesheet + script only on the AI Stylist page.
 * Inject the REST API base URL for the JS to consume.
 * --------------------------------------------------------- */
add_action('wp_enqueue_scripts', 'ruhratna_ais_enqueue_assets', 999);
function ruhratna_ais_enqueue_assets() {
    if (!is_page(RUHRATNA_AIS_PAGE_SLUG)) {
        return;
    }

    wp_enqueue_style(
        'ruhratna-ais-css',
        RUHRATNA_AIS_URL . 'assets/css/stylist.css',
        [],
        RUHRATNA_AIS_VERSION
    );

    wp_enqueue_script(
        'ruhratna-ais-js',
        RUHRATNA_AIS_URL . 'assets/js/stylist.js',
        [],
        RUHRATNA_AIS_VERSION,
        true
    );

    wp_localize_script('ruhratna-ais-js', 'ruhratnaStyler', [
        'apiBase' => esc_url_raw(rest_url('ruhratna-stylist/v1')),
    ]);
}
