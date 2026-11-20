import { expect, test } from '@playwright/test';

test('liga o dispositivo e reage a um cenário de teste', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();

	// Desligado: o LCD está apagado e os cenários ficam bloqueados
	await expect(page.getByRole('button', { name: 'Alagamento', exact: true })).toBeDisabled();

	await page.getByRole('button', { name: 'Ligar o dispositivo' }).click();
	const estado = page.locator('.estado');
	const lcd = page.getByLabel('Display LCD 16x2');
	await expect(estado).toContainText('Normal');
	await expect(lcd).toContainText('NORMAL');

	// A câmera "vê" o alagamento com 90%: o firmware confirma o CRITICO depois de 3 leituras seguidas
	await page.getByRole('button', { name: 'Alagamento', exact: true }).click();
	await expect(estado).toContainText('Crítico');
	await expect(lcd).toContainText('Alagado 90%');
	await expect(page.getByLabel('LED vermelho: aceso')).toBeVisible();

	// O evento vira um pré-chamado, publicado quando o broker conecta ou guardado na fila offline
	await page.getByRole('tab', { name: /Eventos/ }).click();
	await expect(page.getByText('Pré-chamado')).toBeVisible({ timeout: 10_000 });
});

test('mostra o sketch.ino com a decisão atual marcada', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Ligar o dispositivo' }).click();
	await page.getByRole('button', { name: 'Código', exact: true }).click();

	const codigo = page.getByRole('complementary', { name: 'Código do firmware' });
	await expect(codigo.getByRole('heading', { name: 'sketch.ino' })).toBeVisible();
	await expect(codigo.getByText('int decidirEstado() {')).toBeAttached();
	await expect(codigo.getByRole('button', { name: /Decisão atual: Via em ordem/ })).toBeVisible();
});

test('mostra o circuito em 2D e desliga pela chave', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Ligar o dispositivo' }).click();
	await page.getByRole('button', { name: 'Circuito', exact: true }).click();

	const circuito = page.getByRole('group', { name: 'Esquema do circuito do dispositivo' });
	await expect(circuito).toBeVisible();
	await expect(circuito.getByText('ESP32-CAM · OV2640')).toBeVisible();
	// O LCD do circuito mostra o mesmo texto que o firmware escreveu
	await expect(circuito.locator('text.lcd').first()).toContainText('NORMAL');

	// A chave do circuito é a chave liga/desliga do dispositivo
	const chave = circuito.getByRole('switch', { name: 'Chave liga/desliga do dispositivo' });
	await expect(chave).toHaveAttribute('aria-checked', 'true');
	await chave.click();
	await expect(chave).toHaveAttribute('aria-checked', 'false');
	await expect(page.getByRole('button', { name: 'Ligar o dispositivo' })).toBeVisible();
	await expect(page.getByLabel('LED verde: apagado')).toBeVisible();

	await page.getByRole('tab', { name: /Serial/ }).click();
	await expect(page.getByText('Dispositivo desligado')).toBeVisible();
});
