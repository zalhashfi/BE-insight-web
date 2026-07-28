CREATE TABLE `unregistered_devices` (
	`mac_address` varchar(20) NOT NULL,
	`last_seen_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `unregistered_devices_mac_address` PRIMARY KEY(`mac_address`)
);
