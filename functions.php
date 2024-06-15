<?php
function ecolive_child_enqueue_scripts() {
    // Enqueue parent theme styles
    wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
    
    // Enqueue custom JS file
    wp_enqueue_script('custom-js', get_stylesheet_directory_uri() . '/js/demo.js', array('jquery'), null, true);

    // Localize the script with new data
    wp_localize_script('custom-js', 'wc_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php')
    ));
}
add_action('wp_enqueue_scripts', 'ecolive_child_enqueue_scripts');

function get_cart_total() {
    // Ensure WooCommerce is loaded
    if (class_exists('WC_Cart')) {
        $total = WC()->cart->total;
        wp_send_json_success(array('total' => $total));
    } else {
        wp_send_json_error('WooCommerce is not available');
    }
}
add_action('wp_ajax_get_cart_total', 'get_cart_total');
add_action('wp_ajax_nopriv_get_cart_total', 'get_cart_total');
?>